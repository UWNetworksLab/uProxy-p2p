/// <reference path='../../../third_party/wrtc/wrtc.d.ts' />

/*
 * Pure Node implementation of Zork for uProxy Cloud Servers.
 * Rough lifecycle is to process single word commands such as "ping" until
 * "give" or "get" is received, at which point a p2p proxy session is
 * established and further input is treated as signaling channel messages.
 */


// TODO list summary:
// - Use any specified `transform` settings once they are supported.
//   Currently we stash them in the context but then ignore them.
// - Consider sending a response to acknowledge successful processing of the
//   `transform` command (protocol-level change, see TODO below)
// - Remove BOOTSTRAP data channel if possible (see TODO below)
// - Make sure there are no resource leaks (see "cleanup" TODO below)
// - Implement backpressure (see "backpressure" TODO below)
// - Factor out logic duplicated in ../socks/bin/webrtc.ts
// - Replace console log calls with something more structured?
// - Do error states ever need to be indicated to clients rather than
// - just logged locally?


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
let numZorkConnections = 0;  // ever made (as opposed to currently active)
let numGetters = 0;  // currently active (not ever)
let socksServer: SocksServer = null;  // initialized lazily, on 'get' command
const BOOTSTRAP_CHANNEL_ID = 'BOOTSTRAP-DATACHANNEL__CLOSED-ON-CONNECT';
const RTC_PEER_CONFIG = {
  iceServers: [
    {url: 'stun:stun.l.google.com:19302'},
    {url: 'stun:stun1.l.google.com:19302'},
    {url: 'stun:stun.services.mozilla.com'}
  ]
};

interface ParsedCmd {
  verb: string;      // e.g. 'ping', 'give', 'get', 'transform', etc.
  source: string;    // e.g. 'transform with caesar'
  tokens: string[];  // e.g. ['transform', 'with', 'caesar']
}

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
  mode: string;  // 'give', 'get', or null to indicate still waiting for a 'give' or 'get' command
  transformer: any;  // Stores any requested transform settings.
  socksSession: SocksSession;  // Set to a socks session if we're giving access.
  rtc: RTCState;
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

const initPeerConnection = (ctx: Context) => {
  const conn = ctx.rtc.conn = new RTCPeerConnection(RTC_PEER_CONFIG);
  conn.onsignalingstatechange = (event: any) => ctx.log(`signaling state change`);
  conn.oniceconnectionstatechange = (event: any) => ctx.log(`ice connection state change`);
  conn.onicegatheringstatechange = (event: any) => ctx.log(`ice gathering state change`);
  conn.onicecandidate = (event: any) => ctx.reply(JSON.stringify(event));
  conn.ondatachannel = (event: any) => onDataChannel(ctx, event.channel);
};

const onDataChannel = (ctx: Context, channel: any) => {
  const channelId = channel.label;
  if (ctx.mode === 'get') {
    // ondatachannel events don't fire for the peer creating the datachannel.
    // getter creates datachannels -> this should only run when we're the giver.
    ctx.log(`onDataChannel: ignoring unexpected datachannel ${channelId} created by giver`);
    return;
  }
  if (channelId === BOOTSTRAP_CHANNEL_ID) {
    ctx.log(`onDataChannel: BOOTSTRAP datachannel`);
    return;
  }
  ctx.log(`onDataChannel: [channelId ${channelId}] [channel.readyState ${channel.readyState}]`);
  initSocksSession(ctx, channel);
  channel.onopen = () => ctx.log(`[channelId ${channelId}] datachannel opened`);
  channel.onclose = () => ctx.log(`[channelId ${channelId}] datachannel closed`);
  channel.onerror = (err: any) => ctx.log.error(`[channelId ${channelId}] datachannel error: ${err}`);
  channel.onmessage = (event: any) => ctx.socksSession.handleDataFromSocksClient(event.data);
};

/*
 * Start giving access to the peer.
 */
const handleCmdGive = (ctx: Context) => {
  ctx.mode = 'give';
  ctx.log(`set mode to "give"`);
  initPeerConnection(ctx);
};

/*
 * Start getting access from the peer.
 */
const handleCmdGet = (ctx: Context) => {
  ctx.mode = 'get';
  ctx.log('set mode to "get"');

  if (!socksServer) {
    ctx.log(`starting socks server....`);
    socksServer = new SocksServer(SOCKS_HOST, SOCKS_PORT);
    socksServer.onConnection((sessionId) => onSocksConnection(ctx, sessionId));
    socksServer.listen().then(() => {
      ctx.log(`[socksServer] listening on ${SOCKS_HOST}:${SOCKS_PORT}`);
      ctx.log(`Test with e.g. curl -x socks5h://${SOCKS_HOST}:${SOCKS_PORT} httpbin.org/ip`);
    });
  }
  initPeerConnection(ctx);

  // Connection stalls unless we do this here. TODO: Remove if possible.
  ctx.rtc.conn.createDataChannel(BOOTSTRAP_CHANNEL_ID);

  // Getter is offerer.
  ctx.rtc.conn.createOffer((offer: any) => {
    ctx.rtc.conn.setLocalDescription(offer);
    const json = JSON.stringify(offer);
    ctx.log(`forwarding offer: ${json}`);
    ctx.reply(json);
  }, ctx.log.error);
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
      ctx.log.error(`datachannel congested, dropping bytes! TODO: backpressure`);
    }
  });

  session.onDisconnect(() => ctx.log(`SOCKS session disconnected`));
};

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


const handleSignaling = (ctx: Context, msg: string) => {
  const data = JSON.parse(msg);
  if (data.type === 'icecandidate' && data.candidate) {
    handleIce(ctx, data);
  } else if (data.type === 'offer' && data.sdp && ctx.mode === 'give') {
    // Getter is offerer, so giver receives the offer.
    ctx.rtc.remoteReceived = true;
    ctx.log(`got offer: ${msg} -> remoteReceived = true`);
    numGetters++;
    ctx.log(`incremented numGetters to ${numGetters}`);
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
    ctx.log(`handleIce: remoteReceived: adding ice candidate...`);
    ctx.rtc.conn.addIceCandidate(data.candidate);
  } else {
    ctx.log(`handleIce: !remoteReceived: adding pending ice candidate`);
    ctx.rtc.pendingCandidates.push(data.candidate);
  }
};


const parseCmd = (cmdline: string) : ParsedCmd => {
  const tokens = cmdline.split(/\W+/);
  const verb = tokens[0].toLowerCase();
  const parsed = {verb: verb, tokens: tokens, source: cmdline};
  return parsed;
};


const handleMsg = (ctx: Context, msg: string) => {
  if (ctx.mode) { // Already in 'give' or 'get' mode. Treat msg as signaling.
    handleSignaling(ctx, msg);
  } else { // Not yet in 'give' or 'get' mode. Treat msg as command.
    const cmd = parseCmd(msg);
    const cmdHandler = cmdHandlerByVerb[cmd.verb] || handleCmdInvalid;
    cmdHandler(ctx, cmd);
  }
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
      ctx.log(`[socksServer] [session ${sessionId}] client disconnected`);
      return this;
    }
  };
};


const zorkServer = net.createServer((client) => {
  const clientId = `zc${numZorkConnections++}`;
  const ctx: Context = {
    clientId: clientId,
    socket: client,
    reply: makeReplyFunction(client),
    log: null,
    mode: null,
    transformer: null,
    socksSession: null,
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
    if (ctx.mode === 'give' && ctx.rtc.conn) {
      numGetters--;
      ctx.log(`decremented numGetters to ${numGetters}`);
    }
    // TODO: any cleanup necessary here to make sure resources allocated
    // for this client will be reclaimed? e.g. need to set `ctx = null` for gc?
  });
});
zorkServer.listen(ZORK_PORT);
zorkServer.on('listening', () => console.info('[zorkServer] listening on port', ZORK_PORT));

const makeReplyFunction = (socket: net.Socket) : ((msg: string) => void)  => {
  return (msg: string) => {
    socket.write(msg);
    socket.write(MSG_DELIM);
  };
};

const makeLogger = (ctx: Context) => {
  const prefix = (level: string) => {
    const now = new Date();
    const s = `[${now.toTimeString().substring(0, 8)}.${now.getMilliseconds()}]`
            + ` [${level}]`
            + ` [client ${ctx.clientId}]`
            + ` [${ctx.mode}]`;
    return s;
  };
  let logger: any = (...args: any[]) => console.info(prefix('INFO'), ...args);
  logger.error = (...args: any[]) => console.error(prefix('ERROR'), ...args);
  return logger;
};
