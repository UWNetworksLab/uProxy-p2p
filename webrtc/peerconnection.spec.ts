/// <reference path='../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />

/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />

import MockFreedomRtcPeerConnection =
  require('../freedom/mocks/mock-rtcpeerconnection');
import RTCPeerConnection = freedom_RTCPeerConnection.RTCPeerConnection;
import RTCDataChannelInit = freedom_RTCPeerConnection.RTCDataChannelInit;

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
freedom = freedomMocker.makeSkeletonFreedomInModuleEnv();

import WebRtcTypes = require('./webrtc.types');
import WebRtcEnums = require('./webrtc.enums');
import PeerConnectionClass = require('./peerconnection');

describe('peerconnection', function() {
  var mockRtcPeerConnection :MockFreedomRtcPeerConnection;

  beforeEach(function() {
    mockRtcPeerConnection = new MockFreedomRtcPeerConnection();
  });

  // Ensure that ICE candidate gathering, which is initiated by a call to
  // setLocalDescription, is not initiated prior to sending the OFFER signal:
  //   https://github.com/uProxy/uproxy/issues/784
  it('Candidate gathering should not start before offer signal is sent',
      (done) => {
    // When |mockRtcPeerConnection.createDataChannel| is called (happens from
    // negotiateConnection), make a fake 'onnegotiationneeded' event. This will
    // cause |mockRtcPeerConnection.createOffer| to be called.
    var createDataChannelSpy =
      spyOn(mockRtcPeerConnection, "createDataChannel");
    createDataChannelSpy.and.callFake((
          label:string, init:RTCDataChannelInit) => {
      mockRtcPeerConnection.eventHandler.fakeAnEvent(
          'onnegotiationneeded', null);
    }).and.callThrough();

    // Make |createOffer| resolve to a mock offer.
    var createOfferSpy = spyOn(mockRtcPeerConnection, "createOffer");
    var mockOffer :freedom_RTCPeerConnection.RTCSessionDescription = {
      type: 'sdp',
      sdp: 'mock:sdp'
    };
    createOfferSpy.and.returnValue(Promise.resolve(mockOffer));

    // We mock setLocalDescription, because we want to check that it has not
    // been called by the time the first signalling message is added to the
    // handler queue.
    var setLocalDescriptionSpy =
      spyOn(mockRtcPeerConnection, "setLocalDescription");

    var pc = new PeerConnectionClass(mockRtcPeerConnection, 'test');
    pc.negotiateConnection();

    pc.signalForPeerQueue.setSyncNextHandler(
        (signal:WebRtcTypes.SignallingMessage) => {
      expect(signal.type).toEqual(WebRtcEnums.SignalType.OFFER);
      expect(setLocalDescriptionSpy).not.toHaveBeenCalled();
      done();
    });

  });
});
