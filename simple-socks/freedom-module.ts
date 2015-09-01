/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import bridge = require('../bridge/bridge');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import net = require('../net/net.types');
import rtc_to_net = require('../rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../socks-to-rtc/socks-to-rtc');
import tcp = require('../net/tcp');

export var moduleName = 'simple-socks';
export var log :logging.Log = new logging.Log(moduleName);

// Set each module to info, warn, error, or debug depending on which module
// you're debugging. Since the proxy outputs quite a lot of messages, show only
// warnings by default from the rest of the system.  Note that the proxy is
// extremely slow in debug mode.
export var loggingController = freedom['loggingcontroller']();

// Example to show how to manuall configure console filtering.
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

//-----------------------------------------------------------------------------
var localhostEndpoint:net.Endpoint = { address: '0.0.0.0', port:9999 };

//-----------------------------------------------------------------------------
// Don't specify STUN servers because they aren't needed and can, in fact,
// present a problem when Simple SOCKS is running on a system behind a NAT
// without support for hair-pinning.
var pcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
  iceServers: []
};

export var rtcNet = new rtc_to_net.RtcToNet();
rtcNet.start({
  allowNonUnicast: true
}, bridge.best('rtctonet', pcConfig));

//-----------------------------------------------------------------------------
export var socksRtc = new socks_to_rtc.SocksToRtc();
socksRtc.on('signalForPeer', rtcNet.handleSignalFromPeer);
socksRtc.start(new tcp.Server(localhostEndpoint),
    bridge.best('sockstortc', pcConfig)).then(
    (endpoint:net.Endpoint) => {
  log.info('SocksToRtc listening on %1', endpoint);
  log.info('curl -x socks5h://%1:%2 www.example.com',
      endpoint.address, endpoint.port);
}, (e:Error) => {
  log.error('failed to start SocksToRtc: %1', e.message);
});

//-----------------------------------------------------------------------------

var getterBytesReceived :number = 0;
var getterBytesSent :number = 0;
var giverBytesReceived :number = 0;
var giverBytesSent :number = 0;

rtcNet.signalsForPeer.setSyncHandler(socksRtc.handleSignalFromPeer);

// TODO: Re-enable received/sent messages when per-component logging is fixed:
//         https://github.com/uProxy/uproxy/issues/906
socksRtc.on('bytesReceivedFromPeer', (numBytes:number) => {
  getterBytesReceived += numBytes;
  // log.debug('Getter received ' + numBytes + ' bytes. (Total received: '
  //   + getterBytesReceived + ' bytes)');
});

socksRtc.on('bytesSentToPeer', (numBytes:number) => {
  getterBytesSent += numBytes;
  // log.debug('Getter sent ' + numBytes + ' bytes. (Total sent: '
  //   + getterBytesSent + ' bytes)');
});

rtcNet.bytesReceivedFromPeer.setSyncHandler((numBytes:number) => {
  giverBytesReceived += numBytes;
  // log.debug('Giver received ' + numBytes + ' bytes. (Total received: '
  //   + giverBytesReceived + ' bytes)');
});

rtcNet.bytesSentToPeer.setSyncHandler((numBytes:number) => {
  giverBytesSent += numBytes;
  // log.debug('Giver sent ' + numBytes + ' bytes. (Total sent: '
  //   + giverBytesSent + ' bytes)');
});

rtcNet.onceReady
  .then(() => {
    log.info('RtcToNet ready');
  }, (e:Error) => {
    log.error('failed to start RtcToNet: ' + e.message);
  });
