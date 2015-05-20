/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import rtc_to_net = require('../rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../socks-to-rtc/socks-to-rtc');
import net = require('../net/net.types');

import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');

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
var localhostEndpoint:net.Endpoint = { address: '127.0.0.1', port:9999 };

//-----------------------------------------------------------------------------
var pcConfig :freedom_RTCPeerConnection.RTCConfiguration = {
  iceServers: [{urls: ['stun:stun.l.google.com:19302']},
               {urls: ['stun:stun1.l.google.com:19302']}]
};

export var rtcNet = new rtc_to_net.RtcToNet();
rtcNet.startFromConfig({ allowNonUnicast: true }, pcConfig); // obfuscate

//-----------------------------------------------------------------------------
export var socksRtc = new socks_to_rtc.SocksToRtc();
socksRtc.on('signalForPeer', rtcNet.handleSignalFromPeer);
socksRtc.startFromConfig(
    localhostEndpoint,
    pcConfig,
    false) // obfuscate
  .then((endpoint:net.Endpoint) => {
    log.info('SocksToRtc listening on: ' + JSON.stringify(endpoint));
    log.info('curl -x socks5h://' + endpoint.address + ':' + endpoint.port +
        ' www.example.com')
  }, (e:Error) => {
    log.error('failed to start SocksToRtc: ' + e.message);
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
