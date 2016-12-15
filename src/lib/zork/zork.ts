/// <reference path='../../../third_party/wrtc/wrtc.d.ts' />

/*
 * Pure Node implementation of Zork for uProxy Cloud Servers.
 * Rough lifecycle is to process single word commands such as "ping" until
 * "give" or "get" is received, at which point an RTC proxy session is
 * established and further input is treated as signaling channel messages.
 *
 *
 * If a "get" command is received, we start a local SOCKS server, send an RTC
 * offer to establish an RTC connection with the remote peer we'll be getting
 * access from, and set things up to pipe data between our local SOCKS server
 * and the peer connection.
 * As the getter, we are the one that creates the offer, as well as all RTC
 * datachannels. This includes a heartbeat datachannel which is required to
 * to bootstrap the connection and demonstrate it's still alive, as well as a
 * datachannel for each SOCKS connection which actually forwards proxy data.
 *
 *
 * If a "give" command is received, we wait for an RTC offer from the getter,
 * and then send our answer (see handleSignaling below). Once an RTC connection
 * is established, we wait for the getter to create datachannels with us.
 * Each datachannel is created by the getter when they get a connection to
 * their local SOCKS server. When we detect a getter-initiated datachannel,
 * we create a SocksSession for it and set it up to forward data between the
 * Internet and the datachannel.
 *
 *
 * Note: Zork can be giving to one or more clients at the same time it is
 * getting from one or more clients. Each Zork session is independent.
 */


// TODO list summary:
// - Use any specified `transform` settings once they are supported.
//   Currently we stash them in the context but then ignore them.
// - Consider sending a response to acknowledge successful processing of the
//   `transform` command (protocol-level change, see TODO below)
// - Make sure there are no resource leaks (see "cleanup" TODO below)
// - Implement backpressure (see "backpressure" TODO below)
// - Factor out logic duplicated in ../socks/bin/webrtc.ts
// - Replace console log calls with something more structured?
// - Do error states ever need to be indicated to clients rather than
//   just logged locally?


import * as net from 'net';
import {MESSAGE_VERSION} from '../../generic_core/constants';
import {NodeSocksServer as SocksServer} from '../socks/node/server';
import {NodeForwardingSocket as ForwardingSocket} from '../socks/node/socket';
import {SocksSession} from '../socks/session';
import {RTCPeerConnection} from 'wrtc';


// The delimiter for Zork messages is just \n, but we use \r?\n for
// MSG_DELIM_RE so that \r\n sent by e.g. a telnet client will also be treated
// as a delimiter. https://en.wikipedia.org/wiki/Robustness_principle
// "Be conservative in what you send, be liberal in what you accept."
const MSG_DELIM = '\n';
const MSG_DELIM_RE = /\r?\n/;

const ZORK_PORT_DEFAULT = 9000;
const ZORK_PORT = Number(process.argv[2] || ZORK_PORT_DEFAULT);
const SOCKS_HOST = '127.0.0.1';
const SOCKS_PORT_DEFAULT = 9999;
const SOCKS_PORT = Number(process.argv[3] || SOCKS_PORT_DEFAULT);
if (isNaN(ZORK_PORT) || isNaN(SOCKS_PORT)) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} [ZORK_PORT] [SOCKS_PORT]`);
  process.exit(1);
}
let startedSocksServer = false;  // ever started any local SOCKS server
let numZorkConnections = 0;  // ever made (as opposed to currently active)
let numGetters = 0;  // currently active (not ever)
const HEARTBEAT_CHANNEL_ID = 'HEARTBEAT';
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 15000;
const HEARTBEAT_MSG = 'heartbeat';
const RTC_PEER_CONFIG = {
  iceServers: [
    {url: 'stun:stun.l.google.com:19302'},
    {url: 'stun:stun1.l.google.com:19302'},
    {url: 'stun:stun.services.mozilla.com'}
  ]
};

type Mode = 'give' | 'get';

interface RTCState {
  conn: any;
  remoteReceived: boolean;
  pendingCandidates: any[];
}

interface Context {
  clientId: string;
  socket: net.Socket;  // Connection to the zork client. Becomes the signaling channel.
  reply: (msg: string) => void;  // Helper function to reply to the client.
  log: any;  // Helper function for contextual logging.
  mode: Mode;  // null indicates still waiting for a 'give' or 'get' command
  transformer: any;  // Stores any requested transform settings.
  socksServer: SocksServer;  // Set to a SOCKS server if we're getting access.
  socksSession: SocksSession;  // Set to a SOCKS session if we're giving access.
  heartbeatTimeoutId: number;
  onHeartbeatTimeout: Function;
  rtc: RTCState;
}

interface ParsedCmd {
  verb: string;      // e.g. 'ping', 'give', 'get', 'transform', etc.
  source: string;    // e.g. 'transform with caesar'
  tokens: string[];  // e.g. ['transform', 'with', 'caesar']
}


// Command handlers:

const handleCmdInvalid = (ctx: Context, cmd: ParsedCmd) => {
  ctx.reply(`I don't understand that command. (${cmd.verb})`);
};

const handleCmdPing = (ctx: Context) => {
  ctx.reply(`ping`);
};

const handleCmdXyzzy = (ctx: Context) => {
  ctx.reply(`Nothing happens.`);
};

const handleCmdVersion = (ctx: Context) => {
  ctx.reply(`${MESSAGE_VERSION}`);
};

const handleCmdQuit = (ctx: Context) => {
  ctx.socket.end();
};

const handleCmdGetters = (ctx: Context) => {
  ctx.reply(`${numGetters}`);
};

const handleCmdTransform = (ctx: Context, cmd: ParsedCmd) => {
  // TODO: change protocol to acknowledge when processing was successful?
  const t1 = cmd.tokens[1];
  if (t1 === 'with') {
    ctx.transformer = {name: cmd.tokens[2]};
  } else if (t1 === 'config') {
    const idx = cmd.source.indexOf(' config ') + ' config '.length;
    const config = cmd.source.substring(idx);
    ctx.transformer = {config: config};
  } else {
    ctx.reply(`usage: transform (with name|config json)`);
  }
};

const handleCmdGive = (ctx: Context) => {
  ctx.mode = 'give';
  ctx.log(`set mode to "give"`);
  initOnHeartbeatTimeout(ctx);
  initPeerConnection(ctx);
};

const handleCmdGet = (ctx: Context) => {
  ctx.mode = 'get';
  ctx.log('set mode to "get"');

  initSocksServer(ctx);
  initPeerConnection(ctx);

  // RTC connection stalls if no datachannel created before creating the offer,
  // so we need to create a datachannel before creating the offer to bootstrap
  // the connection. Use the heartbeat data channel for this purpose.
  const heartbeatChannel = ctx.rtc.conn.createDataChannel(HEARTBEAT_CHANNEL_ID);
  setInterval(() => heartbeatChannel.send(HEARTBEAT_MSG), HEARTBEAT_INTERVAL_MS);

  // Getter is offerer.
  ctx.rtc.conn.createOffer((offer: any) => {
    ctx.rtc.conn.setLocalDescription(offer);
    const json = JSON.stringify(offer);
    ctx.log(`forwarding offer: ${json}`);
    ctx.reply(json);
  }, ctx.log.error);
};

// End command handlers. Add them to cmdHandlerByVerb map:
const cmdHandlerByVerb: {[verb: string]: (ctx: Context, cmd?: ParsedCmd) => void} = {
  'ping': handleCmdPing,
  'xyzzy': handleCmdXyzzy,
  'version': handleCmdVersion,
  'quit': handleCmdQuit,
  'getters': handleCmdGetters,
  'transform': handleCmdTransform,
  'give': handleCmdGive,
  'get': handleCmdGet
};


// Helper functions for RTC and proxy session establishment:

const initOnHeartbeatTimeout = (ctx: Context) => {
  ctx.onHeartbeatTimeout = () => {
    ctx.log(`${HEARTBEAT_TIMEOUT_MS / 1000}s elapsed with no heartbeat`);
    // TODO: do something here to forcibly end this RTC connection?
    numGetters--;
    ctx.log(`decremented numGetters to ${numGetters}`);
    if (numGetters < 0) {  // should not get here === famous last words
      numGetters = 0;
      ctx.log.error(`numGetters < 0; reset to 0.`);
    }
  };
};

const initPeerConnection = (ctx: Context) => {
  const conn = ctx.rtc.conn = new RTCPeerConnection(RTC_PEER_CONFIG);
  conn.onicecandidate = (event: any) => ctx.reply(JSON.stringify(event));
  conn.ondatachannel = (event: any) => onDataChannel(ctx, event.channel);
  conn.onsignalingstatechange = (event: any) => ctx.log(`signaling state change: ${ctx.rtc.conn.signalingState}`);
  conn.onicegatheringstatechange = (event: any) => ctx.log(`ice gathering state change: ${ctx.rtc.conn.iceGatheringState}`);
  conn.oniceconnectionstatechange = (event: any) => ctx.log(`ice connection state change: ${ctx.rtc.conn.iceConnectionState}`);
};

const initSocksServer = (ctx: Context) => {
  // If we've already started a local SOCKS server running on SOCKS_PORT,
  // use 0 for the port so the OS assigns us a free port.
  const port = startedSocksServer ? 0 : SOCKS_PORT;
  ctx.log(`starting local SOCKS server on port ${port ? port : '[TBD]'}`);
  const server = ctx.socksServer = new SocksServer(SOCKS_HOST, port);
  server.onConnection((sessionId) => onSocksConnection(ctx, sessionId));
  server.listen().then(() => {
    startedSocksServer = true;
    const port = server.address().port;  // in case OS assigned
    ctx.log(`[socksServer] listening on ${SOCKS_HOST}:${port}`);
    ctx.log(`[socksServer] Test with e.g. curl -x socks5h://${SOCKS_HOST}:${port} httpbin.org/ip`);
  });
};

const onDataChannel = (ctx: Context, channel: any) => {
  const channelId = channel.label;
  ctx.log(`onDataChannel: [channel ${channelId}] [channel.readyState ${channel.readyState}]`);

  channel.onclose = () => ctx.log(`[channel ${channelId}] datachannel closed`);
  channel.onerror = (err: any) => ctx.log.error(`[channel ${channelId}] datachannel error: ${err}`);

  // ondatachannel events don't fire for the peer creating the datachannel.
  // Since the getter is always the one that creates datachannels, a getter
  // doesn't expect any giver-created datachannels, so just closes any onopen.
  if (ctx.mode === 'get') {
    channel.onopen = () => {
      channel.close();
      ctx.log.error(`closed unexpected giver-created datachannel`);
    };
    return;
  }
  // Got here -> we're the giver.

  if (channelId === HEARTBEAT_CHANNEL_ID) {  // heartbeat datachannel
    ctx.socket.end();
    ctx.log(`closed zork connection, handoff to RTC complete`);
    numGetters++;
    ctx.log(`incremented numGetters to ${numGetters}`);
    ctx.heartbeatTimeoutId = setTimeout(ctx.onHeartbeatTimeout, HEARTBEAT_TIMEOUT_MS);
    channel.onmessage = (event: any) => {
      ctx.log(`heartbeat: ${event.data}`);
      clearTimeout(ctx.heartbeatTimeoutId);
      ctx.heartbeatTimeoutId = setTimeout(ctx.onHeartbeatTimeout, HEARTBEAT_TIMEOUT_MS);
    };
    return;
  }

  // Got here -> we're the giver, and this is a non-heartbeat datachannel.
  // Initialize a SOCKS session for it, and set its onmessage handler so that
  // it forwards data for the SOCKS session.
  channel.onopen = () => ctx.log(`[channel ${channelId}] datachannel opened`);
  initSocksSession(ctx, channel);
  channel.onmessage = (event: any) => ctx.socksSession.handleDataFromSocksClient(event.data);
};

const onSocksConnection = (ctx: Context, sessionId: any) => {
  ctx.log(`[socksServer] new connection: ${sessionId}`);
  const channel = ctx.rtc.conn.createDataChannel(sessionId);
  return {
    // SOCKS client -> datachannel
    handleDataFromSocksClient: (bytes: ArrayBuffer) => channel.send(bytes),
    // SOCKS client <- datachannel
    onDataForSocksClient: (callback: (buffer: ArrayBuffer) => void) => {
      channel.onmessage = (event: any) => callback(event.data);
      return this;
    },
    handleDisconnect: () => {
      channel.close();
      ctx.log(`[socksServer] [session ${sessionId}] client disconnect, closed datachannel`);
    },
    onDisconnect: (callback: () => void) => {
      // This callback calls client.end(), so we ignore it.
      ctx.log(`[socksServer] [session ${sessionId}] client disconnected`);
      return this;
    }
  };
};

const initSocksSession = (ctx: Context, channel: any) => {
  ctx.log(`initSocksSession: client ${ctx.clientId}`);

  const session = ctx.socksSession = new SocksSession(ctx.clientId);

  session.onForwardingSocketRequired((host: any, port: any) => {
    const forwardingSocket = new ForwardingSocket();
    return forwardingSocket.connect(host, port).then(() => {
      return forwardingSocket;
    });
  });

  // datachannel <- SOCKS session
  session.onDataForSocksClient((bytes: any) => {
    // When too much is buffered, the channel closes/fails.
    const BUFFTHRESHOLD = 16000000;  // 16 megabytes
    if (channel.bufferedAmount < BUFFTHRESHOLD) {
      channel.send(bytes);
    } else {
      ctx.log.error(`[socksSession] datachannel congested, dropping bytes! TODO: backpressure`);
    }
  });

  session.onDisconnect(() => ctx.log(`[socksSession] disconnected`));
};


const handleSignaling = (ctx: Context, msg: string) => {
  const data = JSON.parse(msg);
  if (data.type === 'icecandidate' && data.candidate) {
    handleIce(ctx, data);
  } else if (data.type === 'offer' && data.sdp && ctx.mode === 'give') {
    // Getter is offerer, so giver receives the offer.
    ctx.rtc.remoteReceived = true;
    ctx.log(`got offer: ${msg} -> remoteReceived = true`);
    ctx.rtc.conn.setRemoteDescription(data, () => {
      while (ctx.rtc.pendingCandidates.length) {
        ctx.rtc.conn.addIceCandidate(ctx.rtc.pendingCandidates.shift());
      }
      ctx.rtc.conn.createAnswer((answer: any) => {
        ctx.log(`created answer, setting local description`);
        ctx.rtc.conn.setLocalDescription(answer, () => {
          const json = JSON.stringify(answer);
          ctx.log(`forwarding answer: ${json}`);
          ctx.reply(json);
        }, ctx.log.error);
      }, ctx.log.error);
    }, ctx.log.error);
  } else if (data.type === 'answer' && data.sdp && ctx.mode === 'get') {
    // Giver is answerer, so getter receives the answer.
    ctx.rtc.remoteReceived = true;
    ctx.log(`got answer: ${msg} -> remoteReceived = true`);
    ctx.rtc.conn.setRemoteDescription(data);
  } else {
    ctx.log(`handleSignaling: ignoring msg: ${msg}`);
  }
};

const handleIce = (ctx: Context, data: any) => {
  if (ctx.rtc.remoteReceived) {
    ctx.rtc.conn.addIceCandidate(data.candidate);
    ctx.log(`handleIce: remoteReceived: added ice candidate`);
  } else {
    ctx.rtc.pendingCandidates.push(data.candidate);
    ctx.log(`handleIce: !remoteReceived: added pending ice candidate`);
  }
};


// End RTC/proxy helper functions. Create and start the Zork server:

const zorkServer = net.createServer((client) => {
  const clientId = `zc${numZorkConnections++}`;
  const ctx: Context = {  // Create a context holding the state for this connection
    clientId: clientId,
    socket: client,
    reply: makeReplyFunction(client),
    log: null,
    mode: null,
    transformer: null,
    socksServer: null,
    socksSession: null,
    onHeartbeatTimeout: null,
    heartbeatTimeoutId: null,
    rtc: {
      conn: null,
      remoteReceived: false,
      pendingCandidates: []
    }
  };
  ctx.log = makeLogger(ctx);
  ctx.log(`[zorkServer] client connected`);

  let buffer = '';
  client.on('data', (data) => {
    const chunk = data.toString();
    const msgs = chunk.split(MSG_DELIM_RE);
    const msgDelimNotFound = msgs.length === 1;
    if (msgDelimNotFound) {
      buffer += chunk;
      return;
    }
    msgs[0] = buffer + msgs[0];
    buffer = msgs.pop();
    for (let msg of msgs) {
      if (msg) {  // Ignore empty messages.
        handleMsg(ctx, msg);
      }
    }
  });

  client.on('end', () => {
    ctx.log(`[zorkServer] client disconnected`);
    // TODO: any cleanup necessary here to make sure resources allocated
    // for this client will be reclaimed? e.g. need to set `ctx = null` for gc?
  });
}).listen(ZORK_PORT).on('listening', () => console.info('[zorkServer] listening on port', ZORK_PORT));


// Zork server helper functions:

const handleMsg = (ctx: Context, msg: string) => {
  if (ctx.mode === null) {  // Not yet in 'give' or 'get' mode. Treat msg as command.
    const cmd = parseCmd(msg);
    const cmdHandler = cmdHandlerByVerb[cmd.verb] || handleCmdInvalid;
    cmdHandler(ctx, cmd);
  } else {  // Already in 'give' or 'get' mode. Treat msg as signaling.
    handleSignaling(ctx, msg);
  }
};

const parseCmd = (cmdline: string) : ParsedCmd => {
  const tokens = cmdline.split(/\W+/);
  const verb = tokens[0].toLowerCase();
  const parsed = {verb: verb, tokens: tokens, source: cmdline};
  return parsed;
};


// Context helper functions:

const makeReplyFunction = (socket: net.Socket) : ((msg: string) => void)  => {
  return (msg: string) => {
    socket.write(msg);
    socket.write(MSG_DELIM);
  };
};

const makeLogger = (ctx: Context) => {
  const prefix = (level: string) => {
    const now = new Date();
    const ms = now.getMilliseconds();
    const s = `[${now.toTimeString().substring(0, 8)}`
            + `.${ms < 10 ? '00' : ms < 100 ? '0' : ''}${ms}]`
            + ` [${level}]`
            + ` [client ${ctx.clientId}]`
            + ` [${ctx.mode || 'cmd'}]`;
    return s;
  };
  let logger: any = (...args: any[]) => console.info(prefix('INFO'), ...args);
  logger.error = (...args: any[]) => console.error(prefix('ERROR'), ...args);
  return logger;
};
