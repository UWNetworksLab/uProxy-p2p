/// <reference path='peerconnection.d.ts' />
/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />
/// <reference path='../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

describe('peerconnection', function() {
  var mockPeerConnection :freedom_RTCPeerConnection.RTCPeerConnection;

  beforeEach(function() {
    mockPeerConnection = jasmine.createSpyObj('peerconnection provider', [
      'on',
      'createDataChannel',
      'createOffer',
      'setLocalDescription',
      'getLocalDescription'
    ]);
  });

  it('message ordering', (done) => {
    var negotiateCallback :any;
    mockPeerConnection.on = (eventName:string, callback:any) => {
      if (eventName === 'onicecandidate') {
        var mockCandidateEvent :freedom_RTCPeerConnection.OnIceCandidateEvent = {
          candidate: {
            candidate: 'fake:candidate:yo'
          }
        };
        callback(mockCandidateEvent);
      }
      if (eventName === 'onnegotiationneeded') {
        negotiateCallback = callback;
      }
    };

    mockPeerConnection.createDataChannel = (label:string, init:freedom_RTCPeerConnection.RTCDataChannelInit) => {
      negotiateCallback();
      return Promise.resolve('mocklabel');
    };

    (<any>mockPeerConnection.createOffer).and.returnValue(Promise.resolve());
    (<any>mockPeerConnection.setLocalDescription).and.returnValue(Promise.resolve());
    (<any>mockPeerConnection.getLocalDescription).and.returnValue(Promise.resolve({hello: 'world'}));

    var pc = new WebRtc.PeerConnection(mockPeerConnection);
    pc.signalForPeerQueue.setSyncNextHandler((signal:WebRtc.SignallingMessage) => {
      expect(signal.type).toEqual(WebRtc.SignalType.OFFER);
      pc.signalForPeerQueue.setSyncNextHandler((signal:WebRtc.SignallingMessage) => {
        expect(signal.type).toEqual(WebRtc.SignalType.CANDIDATE);
        done();
      });
    });
    pc.negotiateConnection();
  });
});
