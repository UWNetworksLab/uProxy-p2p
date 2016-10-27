import * as churn from '../churn/churn';
import * as logging from '../logging/logging';
import * as loggingTypes from '../loggingprovider/loggingprovider.types';
import * as peerconnection from '../webrtc/peerconnection';
import * as signals from '../webrtc/signals';

declare const freedom: freedom.FreedomInModuleEnv;

export var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(
    loggingTypes.Destination.console,
    loggingTypes.Level.debug);

export var log :logging.Log = new logging.Log('freedom-chat');

var parentFreedomModule = freedom();

function connectDataChannel(name:string,
    channel:peerconnection.DataChannel) :void {
  channel.onceOpened.then(() => {
    log.info('%1: channel opened', name);
  });
  channel.onceClosed.then(() => {
    log.info('%1: channel closed', name);
  });

  // Forward messages from the remote peer to the UI.
  channel.dataFromPeerQueue.setSyncHandler((data:peerconnection.Data) => {
    log.info('%1: received data from peer: %2', name, data);
    parentFreedomModule.emit('receive' + name, data.str);
  });

  // Forward messages from the UI to the remote peer.
  parentFreedomModule.on('send' + name, (message:string) => {
    channel.send({
      str: message
    });
  });
}

function makePeerConnection(name:string)
    :peerconnection.PeerConnection<signals.Message> {
  var config :freedom.RTCPeerConnection.RTCConfiguration = {
    iceServers: [{
      urls: ['stun:stun.l.google.com:19302']},
      {urls: ['stun:stun1.l.google.com:19302']}]
  };

  var pc = peerconnection.createPeerConnection(config, name);

  // Replace the preceding statement with this in order to use obfuscation.
  // var pc = new churn.Connection(
  //     freedom['core.rtcpeerconnection'](config), name);

  pc.onceConnected.then(() => {
    log.info('%1: connected', name);
  }, (e:Error) => {
    log.error('%1: failed to connect: %2', name, e.message);
  });
  pc.onceClosed.then(() => {
    log.info('%1: closed', name);
  });
  pc.peerOpenedChannelQueue.setSyncHandler(
      (channel:peerconnection.DataChannel) => {
    log.info('%1: peer opened new channel: %2', name, channel.getLabel());
    connectDataChannel(name, channel);
  });
  return pc;
}

// Create our two peers, A and B.
var a = makePeerConnection('A');
var b = makePeerConnection('B')

// Connect the two signalling channels. Normally, these messages would be sent
// over the internet.
a.signalForPeerQueue.setSyncHandler(b.handleSignalMessage);
b.signalForPeerQueue.setSyncHandler(a.handleSignalMessage);

// Have |a| negotiate a connection. Once negotiated, enable the UI and add
// send/receive handlers.
a.negotiateConnection().then(() => {
  log.info('a: negotiated connection');
}, (e:Error) => {
  log.error('could not negotiate peerconnection: ' + e.message);
  parentFreedomModule.emit('error', {})
}).then(() => {
  // Close the connection when the UI tells us.
  parentFreedomModule.on('stop', () => {
    a.close();
  });

  return a.openDataChannel('text');
}).then((channel:peerconnection.DataChannel) => {
  connectDataChannel('A', channel);
  parentFreedomModule.emit('ready', {});
}).catch((e:Error) => {
  log.error('error while opening datachannel: ' + e.message);
  parentFreedomModule.emit('error', {})
});
