/// <reference path='../../../third_party/typings/browser.d.ts' />

import MockFreedomRtcDataChannel =
  require('../freedom/mocks/mock-rtcdatachannel');
import MockFreedomRtcPeerConnection =
  require('../freedom/mocks/mock-rtcpeerconnection');
import RTCPeerConnection = freedom.RTCPeerConnection.RTCPeerConnection;
import RTCDataChannelInit = freedom.RTCPeerConnection.RTCDataChannelInit;

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv();

import signals = require('./signals');
import peerconnection = require('./peerconnection');
import datachannel = require('./datachannel');

describe('PeerConnection', function() {
  var mockRtcPeerConnection :MockFreedomRtcPeerConnection;
  var mockRtcDataChannel :MockFreedomRtcDataChannel;

  beforeEach(function() {
    mockRtcPeerConnection = new MockFreedomRtcPeerConnection();
    mockRtcDataChannel = new MockFreedomRtcDataChannel();
    freedom = freedomMocker.makeMockFreedomInModuleEnv({
      'core.rtcdatachannel': () => { return mockRtcDataChannel; },
      'core.rtcpeerconnection': () => { return mockRtcPeerConnection; }
    });
  });

  // Check that early onmessage events are received and processed.
  it('early onmessage works', (done) => {
    spyOn(mockRtcDataChannel, 'on').and.callThrough();

    var pc = new peerconnection.PeerConnectionClass(
        mockRtcPeerConnection, 'test');
    mockRtcPeerConnection.handleEvent('ondatachannel', {
      channel: 'theChannelId'
    });

    // The data channel message event listener should be registered
    // synchronously after receiving the ondatachannel event.
    expect(mockRtcDataChannel.on).toHaveBeenCalledWith('onmessage',
        jasmine.any(Function));

    // Mock synchronously emit onmessage immediately after ondatachannel.
    mockRtcDataChannel.handleEvent('onmessage', {text: 'foo'});

    pc.peerOpenedChannelQueue.setSyncNextHandler((dc:datachannel.DataChannel) => {
      dc.dataFromPeerQueue.setSyncNextHandler((data:datachannel.Data) => {
        expect(data.str).toEqual('foo');
        done();
      });
    });
  });

  // Ensure that ICE candidate gathering, which is initiated by a call to
  // |setLocalDescription|, is not initiated prior to sending the OFFER signal:
  //   https://github.com/uProxy/uproxy/issues/784
  it('Candidate gathering should not start before offer signal is sent',
      (done) => {
    // The first function negotiateConnection() calls is createDataChannel().
    // When that happens, emit a fake onnegotiationneeded event.
    // This will cause createOffer() to be called.
    var createDataChannelSpy =
      spyOn(mockRtcPeerConnection, 'createDataChannel');
    createDataChannelSpy.and.callFake((
          label:string, init:RTCDataChannelInit) => {
      mockRtcPeerConnection.handleEvent('onnegotiationneeded');
      return Promise.resolve('foo-channel-id');
    });
    var createOfferSpy = spyOn(mockRtcPeerConnection, 'createOffer');
    var mockOffer :freedom.RTCPeerConnection.RTCSessionDescription = {
      type: 'sdp',
      sdp: 'mock:sdp'
    };
    createOfferSpy.and.returnValue(Promise.resolve(mockOffer));

    var setLocalDescriptionSpy = spyOn(mockRtcPeerConnection,
        'setLocalDescription');

    var pc = new peerconnection.PeerConnectionClass(mockRtcPeerConnection,
        'test');
    pc.negotiateConnection();

    pc.signalForPeerQueue.setSyncNextHandler((message:signals.Message) => {
      expect(message.type).toEqual(signals.Type.OFFER);
      expect(mockRtcPeerConnection.setLocalDescription).not.toHaveBeenCalled();
      done();
    });

  });

  it('do not set ICE candidates until setRemoteDescription has resolved', (done) => {
    var createDataChannelSpy = spyOn(mockRtcPeerConnection, 'createDataChannel');
    createDataChannelSpy.and.callFake((label:string, init:RTCDataChannelInit) => {
      mockRtcPeerConnection.handleEvent('onnegotiationneeded');
      return Promise.resolve('foo-channel-id');
    });

    var createOfferSpy = spyOn(mockRtcPeerConnection, 'createOffer');
    var mockOffer :freedom.RTCPeerConnection.RTCSessionDescription = {
      type: 'sdp',
      sdp: 'mock:sdp'
    };
    createOfferSpy.and.returnValue(Promise.resolve(mockOffer));

    spyOn(mockRtcPeerConnection, 'addIceCandidate').and.returnValue(
        Promise.resolve());

    var setRemoteDescriptionSpy = spyOn(mockRtcPeerConnection,
        'setRemoteDescription').and.callFake(
        (desc:freedom.RTCPeerConnection.RTCSessionDescription) => {
      // Set a candidate *before* setRemoteDescription() has resolved.
      pc.handleSignalMessage({
        type: signals.Type.CANDIDATE,
        candidate: {
          candidate: 'fakeCandidate'
        }
      });
      expect(mockRtcPeerConnection.addIceCandidate).not.toHaveBeenCalled();
      return Promise.resolve();
    });

    var pc = new peerconnection.PeerConnectionClass(mockRtcPeerConnection);
    pc.negotiateConnection();
    pc.handleSignalMessage({
      type: signals.Type.ANSWER,
      description: {
        type: 'fakeType',
        sdp: 'fakeSdp'
      }
    }).then(() => {
      expect(mockRtcPeerConnection.addIceCandidate).toHaveBeenCalled();
      done();
    });
  });
});

describe('extractMaxChannelsFromSdp_', function() {
  it('simple example', () => {
      expect(peerconnection.PeerConnectionClass.extractMaxChannelsFromSdp_(
          'a=sctpmap:5000 webrtc-datachannel 256')).toEqual(256);
  });

  it('multiple lines', () => {
      expect(peerconnection.PeerConnectionClass.extractMaxChannelsFromSdp_(
          'v=0\na=sctpmap:5000 webrtc-datachannel 256\nt=0 0')).toEqual(256);
  });

  it('unknown protocol', () => {
    expect(() => {
      peerconnection.PeerConnectionClass.extractMaxChannelsFromSdp_(
          'a=sctpmap:5000 banjo 256');
    }).toThrow();
  });

  it('weird number', () => {
    expect(() => {
      peerconnection.PeerConnectionClass.extractMaxChannelsFromSdp_(
          'a=sctpmap:5000 webrtc-datachannel a1');
    }).toThrow();
  });
});
