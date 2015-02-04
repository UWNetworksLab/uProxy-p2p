/// <reference path='../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />

/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
freedom = freedomMocker.makeSkeletonFreedomInModuleEnv();

import WebRtcTypes = require('./webrtc.types');
import WebRtcEnums = require('./webrtc.enums');
import PeerConnectionClass = require('./peerconnection');

describe('peerconnection', function() {
  var mockPeerConnection :freedom_RTCPeerConnection.RTCPeerConnection;

  beforeEach(function() {
    mockPeerConnection = jasmine.createSpyObj('peerconnection provider', [
      'on',
      'createDataChannel',
      'createOffer',
      'setLocalDescription'
    ]);
  });

  // Ensure that ICE candidate gathering, which is initiated by a call to
  // setLocalDescription, is not initiated prior to sending the OFFER signal:
  //   https://github.com/uProxy/uproxy/issues/784
  it('candidate gathering should not start before offer signal has been emitted', (done) => {
    var negotiateCallback :() => void;

    mockPeerConnection.on = (eventName:string, callback:() => void) => {
      if (eventName === 'onnegotiationneeded') {
        negotiateCallback = callback;
      }
    };

    mockPeerConnection.createDataChannel = (label:string,
        init:freedom_RTCPeerConnection.RTCDataChannelInit) => {
      negotiateCallback();
      return Promise.resolve('mocklabel');
    };

    var mockOffer :freedom_RTCPeerConnection.RTCSessionDescription = {
      type: 'sdp',
      sdp: 'mock:sdp'
    };

    (<any>mockPeerConnection.createOffer).and.returnValue(
        Promise.resolve(mockOffer));
    (<any>mockPeerConnection.setLocalDescription).and.returnValue(
        Promise.resolve());

    var pc = new PeerConnectionClass(mockPeerConnection, 'test');

    pc.signalForPeerQueue.setSyncNextHandler((signal:WebRtcTypes.SignallingMessage) => {
      expect(signal.type).toEqual(WebRtcEnums.SignalType.OFFER);
      expect(mockPeerConnection.setLocalDescription).not.toHaveBeenCalled();
      done();
    });

    pc.negotiateConnection();
  });
});
