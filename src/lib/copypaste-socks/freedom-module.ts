/// <reference path='../../../../third_party/typings/browser.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import bridge = require('../bridge/bridge');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import net = require('../net/net.types');
import onetime = require('../bridge/onetime');
import rtc_to_net = require('../rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../socks-to-rtc/socks-to-rtc');
import tcp = require('../net/tcp');

declare const freedom: freedom.FreedomInModuleEnv;

// Set each module to info, warn, error, or debug depending on which module
// you're debugging. Since the proxy outputs quite a lot of messages, show only
// warnings by default from the rest of the system.  Note that the proxy is
// extremely slow in debug mode.
var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(
    loggingTypes.Destination.console,
    loggingTypes.Level.debug);

var log :logging.Log = new logging.Log('copypaste-socks');

var pgp :freedom.PgpProvider.PgpProvider = freedom['pgp']();
var friendKey :string;

var parentModule = freedom();

// TODO interactive setup w/real passphrase
pgp.setup('', 'uProxy user <noreply@uproxy.org>')
  .then(pgp.exportKey)
  .then((publicKey:freedom.PgpProvider.PublicKey) => {
  parentModule.emit('publicKeyExport', publicKey.key);
});

var pcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
  iceServers: [{urls: ['stun:stun.l.google.com:19302']},
               {urls: ['stun:stun1.l.google.com:19302']},
               {urls: ['stun:stun.services.mozilla.com']}]
};

// These two modules together comprise a SOCKS server:
//  - socks-to-rtc is the frontend, which speaks the SOCKS protocol
//  - rtc-to-net creates sockets on behalf of socks-to-rtc
//
// The two modules communicate via a peer-to-peer connection.
//
// If we receive the 'start' signal from the UI then we create a
// socks-to-rtc module and this app will run the SOCKS frontend.
// If we receive signalling channel messages without having received
// the 'start' signal then we create an rtc-to-net instance and
// will act as the SOCKS backend.
var socksRtc:socks_to_rtc.SocksToRtc;
var rtcNet:rtc_to_net.RtcToNet;

var portControl = freedom['portControl']();

var batcher = new onetime.SignalBatcher<bridge.SignallingMessage>(
    (signal:bridge.SignallingMessage) => {
  parentModule.emit('signalForPeer', signal);
}, bridge.isTerminatingSignal);

var doStart = () => {
  var localhostEndpoint:net.Endpoint = { address: '0.0.0.0', port: 9999 };

  socksRtc = new socks_to_rtc.SocksToRtc();

  // SocksToRtc adds the number of bytes it sends/receives to its respective
  // queue as it proxies. When new numbers (of bytes) are added to these queues,
  // emit the number to the UI (look for corresponding freedom.on in main.html).
  socksRtc.bytesReceivedFromPeer.setSyncHandler((numBytes:number) => {
    parentModule.emit('bytesReceived', numBytes);
  });

  socksRtc.bytesSentToPeer.setSyncHandler((numBytes:number) => {
    parentModule.emit('bytesSent', numBytes);
  });

  socksRtc.onceStopped.then(() => {
    parentModule.emit('proxyingStopped');
  });

  socksRtc.start(new tcp.Server(localhostEndpoint),
      bridge.best('sockstortc', pcConfig, portControl)).then(
      (endpoint:net.Endpoint) => {
    log.info('SocksToRtc listening on %1', endpoint);
    log.info('curl -x socks5h://%1:%2 www.example.com',
        endpoint.address, endpoint.port);
  }, (e:Error) => {
    log.error('failed to start SocksToRtc: %1', e.message);
  });

  // Forward signalling channel messages to the UI.
  socksRtc.signalsForPeer.setSyncHandler(batcher.addToBatch);
}

parentModule.on('start', doStart);

// Receive signalling channel messages from the UI and
// reply with a signalMessageResult message indicating
// whether it's well formed.
parentModule.on('validateSignalMessage', (encodedMessage:string) => {
  try {
    onetime.decode(encodedMessage);
    parentModule.emit('signalMessageResult', true);
  } catch (e) {
    log.warn('input is badly formed');
    parentModule.emit('signalMessageResult', false);
  }
});

// Receive signalling channel messages from the UI.
// Messages are dispatched to either the socks-to-rtc or rtc-to-net
// modules depending on whether we're acting as the frontend or backend,
// respectively.
parentModule.on('handleSignalMessage', (encodedMessage:string) => {
  // The UI should only call this function once the message has
  // already been successfully decoded, via validateSignalMessage,
  // so we don't perform any error checking here.
  var messages = onetime.decode(encodedMessage);

  if (socksRtc !== undefined) {
    messages.forEach(socksRtc.handleSignalFromPeer);
  } else {
    if (rtcNet === undefined) {
      rtcNet = new rtc_to_net.RtcToNet();
      rtcNet.start({
        allowNonUnicast: true
      }, bridge.best('rtctonet', pcConfig, portControl));
      log.info('created rtc-to-net');

      // Forward signalling channel messages to the UI.
      rtcNet.signalsForPeer.setSyncHandler(batcher.addToBatch);

      // Similarly to with SocksToRtc, emit the number of bytes sent/received
      // in RtcToNet to the UI.
      rtcNet.bytesReceivedFromPeer.setSyncHandler((numBytes:number) => {
          parentModule.emit('bytesReceived', numBytes);
      });

      rtcNet.bytesSentToPeer.setSyncHandler((numBytes:number) => {
          parentModule.emit('bytesSent', numBytes);
      });

      rtcNet.onceReady.then(() => {
        log.info('rtcNet ready.');
        parentModule.emit('proxyingStarted', null);
      });

      rtcNet.onceStopped.then(() => {
        parentModule.emit('proxyingStopped');
      });
    }
    messages.forEach(rtcNet.handleSignalFromPeer);
  }
});

// Crypto request messages
parentModule.on('friendKey', (newFriendKey:string) => {
  friendKey = newFriendKey;
});

parentModule.on('signEncrypt', (message:string) => {
  pgp.signEncrypt(arraybuffers.stringToArrayBuffer(message), friendKey)
    .then((cipherdata:ArrayBuffer) => {
      return pgp.armor(cipherdata);
    })
    .then((ciphertext:string) => {
      parentModule.emit('ciphertext', ciphertext);
    });
});

parentModule.on('verifyDecrypt', (ciphertext:string) => {
  pgp.dearmor(ciphertext)
    .then((cipherdata:ArrayBuffer) => {
      return pgp.verifyDecrypt(cipherdata, friendKey);
    })
    .then((result:freedom.PgpProvider.VerifyDecryptResult) => {
      parentModule.emit('verifyDecryptResult', result);
    });
});

// Stops proxying.
parentModule.on('stop', () => {
  if (socksRtc !== undefined) {
    socksRtc.stop();
  } else if (rtcNet !== undefined) {
    rtcNet.stop();
  }
});
