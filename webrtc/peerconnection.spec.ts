/// <reference path='peerconnection.d.ts' />
/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />
/// <reference path='../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

import MockFreedomRtcPeerConnection =
  require('../freedom/mocks/mock-rtcpeerconnection');
import RTCPeerConnection = freedom_RTCPeerConnection.RTCPeerConnection;

describe('peerconnection', function() {
  var mockRtcPeerConnection :RTCPeerConnection;

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
    createDataChannelSpy.and.callFake((x) => {
      mockRtcPeerConnection.eventHandler.fakeEvent('onnegotiationneeded', null)
      createDataChannelSpy.and.stub(x);
    })

    // Make |createOffer| resolve to a mock offer.
    var createOfferSpy = spyOn(mockRtcPeerConnection, "createOffer");
    var mockOffer :freedom_RTCPeerConnection.RTCSessionDescription = {
      type: 'sdp',
      sdp: 'mock:sdp';
    };
    createOfferSpy.and.returnVaue(new Promise.resolve(mockOffer));

    // We mock setLocalDescription, because we want to check that it has not
    // been called by the time the first signalling message is added to the
    // handler queue.
    var setLocalDescriptionSpy =
      spyOn(mockRtcPeerConnection, "setLocalDescription");

    var pc = new WebRtc.PeerConnection(mockRtcPeerConnection, 'test');
    pc.negotiateConnection();

    pc.signalForPeerQueue.setSyncNextHandler((signal:WebRtc.SignallingMessage) => {
      expect(signal.type).toEqual(WebRtc.SignalType.OFFER);
      expect(setLocalDescriptionSpy).not.toHaveBeenCalled();
      done();
    });

  });
});
