/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
import mockFreedomRtcPeerConnection = require('../freedom/mocks/mock-rtcpeerconnection');
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.rtcpeerconnection': () => { return new mockFreedomRtcPeerConnection(); }
});

import aggregate = require('../handler/aggregate');
import bridge = require('./bridge');
import churn_types = require('../churn/churn.types');
import datachannel = require('../webrtc/datachannel');
import handler = require('../handler/queue');
import peerconnection = require('../webrtc/peerconnection');
import peerconnection_types = require('../webrtc/signals');

////////
// For mocking async functions.
////////

var voidPromise = Promise.resolve<void>();
var noopPromise = new Promise<void>((F, R) => {});

////////
// Test signals.
////////

var offerSignal: peerconnection_types.Message = {
  type: peerconnection_types.Type.OFFER,
  description: {
    type: 'fake',
    sdp: 'my very long sdp'
  }
};

var candidateSignal1: peerconnection_types.Message = {
  type: peerconnection_types.Type.CANDIDATE,
  candidate: {
    candidate: 'find me here'
  }
};

var noMoreCandidatesSignal: peerconnection_types.Message = {
  type: peerconnection_types.Type.NO_MORE_CANDIDATES
};

var churnOfferSignal: churn_types.ChurnSignallingMessage = {
  webrtcMessage: offerSignal
};

var churnCandidateSignal1: churn_types.ChurnSignallingMessage = {
  webrtcMessage: candidateSignal1
};

var churnNoMoreCandidatesSignal: churn_types.ChurnSignallingMessage = {
  webrtcMessage: noMoreCandidatesSignal
};

var churnPublicEndpointSignal: churn_types.ChurnSignallingMessage = {
  publicEndpoint: {
    address: '127.0.0.1',
    port: 80
  }
};

////////
// Static helpers.
////////

describe("makeSingleProviderMessage", function() {
  it('basic', () => {
    var signals = [
      {
        'line' : 1
      },
      {
        'line' : 2
      }
    ];
    var result = bridge.makeSingleProviderMessage(
        bridge.SignallingMessageType.OFFER,
        bridge.ProviderType.LEGACY,
        signals);
    var expected: bridge.SignallingMessage = {
      type: 'OFFER',
      providers: {
        'LEGACY': {
          signals: signals
        }
      }
    };
    expect(result).toEqual(expected);
  });
});

////////
// Batching.
////////

describe('pickBestProviderType', function() {
  it('basic', () => {
    var legacyProvider: bridge.Provider = {
      signals: [
        {
          'line': 1
        }
      ]
    };
    var churnProvider: bridge.Provider = {
      signals: [
        {
          'line': 1
        }
      ]
    };
    var result = bridge.pickBestProviderType({
      'LEGACY': legacyProvider,
      'CHURN': churnProvider
    });
    expect(result).toEqual(bridge.ProviderType.CHURN);
  });

  it('no providers', () => {
    expect(() => {
      bridge.pickBestProviderType({
        'MAGIC': {}
      });
    }).toThrow();
  });
});

describe('LegacySignalAggregator', function() {
  it('simple batch', (done) => {
    var batcher = aggregate.createAggregateHandler(
        new bridge.LegacySignalAggregator());

    batcher.nextAggregate().then((signals: peerconnection_types.Message[]) => {
      expect(signals.length).toEqual(3);
      expect(signals[0]).toEqual(offerSignal);
      expect(signals[1]).toEqual(candidateSignal1);
      expect(signals[2]).toEqual(noMoreCandidatesSignal);
      done();
    });

    batcher.handle(offerSignal);
    batcher.handle(candidateSignal1);
    batcher.handle(noMoreCandidatesSignal);

    batcher.handle(candidateSignal1);
  });
});

describe('ChurnSignalAggregator', function() {
  it('simple batch', (done) => {
    var batcher = aggregate.createAggregateHandler(
        new bridge.ChurnSignalAggregator());

    batcher.nextAggregate().then((signals: peerconnection_types.Message[]) => {
      expect(signals.length).toEqual(4);
      expect(signals[0]).toEqual(churnOfferSignal);
      expect(signals[1]).toEqual(churnCandidateSignal1);
      expect(signals[2]).toEqual(churnNoMoreCandidatesSignal);
      expect(signals[3]).toEqual(churnPublicEndpointSignal);
      done();
    });

    batcher.handle(churnOfferSignal);
    batcher.handle(churnCandidateSignal1);
    batcher.handle(churnNoMoreCandidatesSignal);
    batcher.handle(churnPublicEndpointSignal);

    batcher.handle(churnCandidateSignal1);
  });
});

////////
// The class itself.
////////

describe('BridgingPeerConnection', function() {
  var mockProvider :peerconnection.PeerConnection<peerconnection_types.Message>;
  var mockProviderSignalQueue = new handler.Queue<peerconnection_types.Message, void>();

  beforeEach(function() {
    mockProvider = <any>{
      peerOpenedChannelQueue: new handler.Queue<datachannel.DataChannel, void>(),
      signalForPeerQueue: mockProviderSignalQueue,
      negotiateConnection: jasmine.createSpy('negotiateConnection'),
      handleSignalMessage: jasmine.createSpy('handleSignalMessage'),
      onceConnected: noopPromise,
      onceClosed: noopPromise
    };
  });

  it('offer and answer', (done) => {
    var bob = bridge.best();
    spyOn(bob, 'makeLegacy_').and.returnValue(mockProvider);

    bob.handleSignalMessage({
      type: 'OFFER',
      providers: {
        'LEGACY': {
          signals: [
            offerSignal,
            candidateSignal1,
            noMoreCandidatesSignal
          ]
        }
      }
    });

    // Make the mock provider send a batch of messages.
    // Later, we will verify these are contained in the answer.
    mockProviderSignalQueue.handle(candidateSignal1);
    mockProviderSignalQueue.handle(noMoreCandidatesSignal);

    bob.signalForPeerQueue.setSyncHandler(
        (signal:bridge.SignallingMessage) => {
      expect(signal.type).toEqual('ANSWER');
      expect(Object.keys(signal.providers)).toContain('LEGACY');
      expect(signal.providers['LEGACY'].signals).toEqual([
        candidateSignal1, noMoreCandidatesSignal]);
      done();
    });
  });

  it('rejects answer having different provider', (done) => {
    var bob = bridge.legacy();
    bob.negotiateConnection();
    bob.handleSignalMessage({
      type: 'ANSWER',
      providers: {
        'CHURN': {}
      }
    });

    bob.signalForPeerQueue.setSyncHandler(
        (signal:bridge.SignallingMessage) => {
      expect(signal.type).toEqual('ERROR');
      done();
    });
  });

  it('onceConnecting fulfills when negotiateConnection called', (done) => {
    var bob = bridge.legacy();
    bob.negotiateConnection();
    bob.onceConnecting.then(done);
  });

  it('onceConnecting fulfills when valid offer received', (done) => {
    var bob = bridge.legacy();
    bob.handleSignalMessage({
      type: 'OFFER',
      providers: {
        'LEGACY': {
          signals: [
            offerSignal,
            candidateSignal1,
            noMoreCandidatesSignal
          ]
        }
      }
    });
    bob.onceConnecting.then(done);
  });

  it('rejects offer from unknown provider', (done) => {
    var bob = bridge.best();
    bob.handleSignalMessage({
      type: 'OFFER',
      providers: {
        'MAGIC': {}
      }
    });

    bob.signalForPeerQueue.setSyncHandler(
        (signal:bridge.SignallingMessage) => {
      expect(signal.type).toEqual('ERROR');
      done();
    });
  });

  it('onceConnected rejects if closed before negotiation', (done) => {
    var bob = bridge.legacy();
    bob.close();
    bob.onceConnected.catch(done);
  });

  it('onceClosed fulfills if closed before negotiation', (done) => {
    var bob = bridge.legacy();
    bob.close();
    bob.onceClosed.then(done);
  });
});
