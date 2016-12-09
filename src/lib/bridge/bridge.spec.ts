import * as freedomMocker from '../freedom/mocks/mock-freedom-in-module-env';
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.rtcpeerconnection': () => { return new mockFreedomRtcPeerConnection(); }
});

import * as bridge from './bridge';
import * as datachannel from '../webrtc/datachannel';
import * as handler from '../handler/queue';
import mockFreedomRtcPeerConnection from '../freedom/mocks/mock-rtcpeerconnection';
import * as peerconnection from '../webrtc/peerconnection';
import * as peerconnection_types from '../webrtc/signals';

////////
// For mocking async functions.
////////

var voidPromise = Promise.resolve();
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

////////
// Static helpers.
////////

describe('makeSingleProviderMessage', function() {
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
        bridge.ProviderType.PLAIN,
        signals);
    var expected: bridge.SignallingMessage = {
      signals: {
        'PLAIN': signals
      }
    };
    expect(result).toEqual(expected);
  });
});

describe('pickBestProviderType', function() {
  it('basic', () => {
    var plainSignals :Object[] = [
      {
        'line': 1
      }
    ];
    var churnSignals :Object[] = [
      {
        'line': 1
      }
    ];
    var result = bridge.pickBestProviderType({
      'PLAIN': plainSignals,
      'CHURN': churnSignals
    });
    expect(result).toEqual(bridge.ProviderType.CHURN);
  });

  it('no providers', () => {
    expect(() => {
      bridge.pickBestProviderType({
        'MAGIC': []
      });
    }).toThrow();
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

  it('offer, answer, wrapping', (done) => {
    var bob = bridge.best();
    spyOn(bob, 'makePlain_').and.returnValue(mockProvider);

    bob.handleSignalMessage({
      signals: {
        'PLAIN': [
            offerSignal,
            candidateSignal1,
            noMoreCandidatesSignal
          ]
        }
    });

    mockProviderSignalQueue.handle(candidateSignal1);

    bob.signalForPeerQueue.setSyncHandler(
        (message:bridge.SignallingMessage) => {
      expect(Object.keys(message.signals)).toContain('PLAIN');
      expect(message.signals['PLAIN']).toEqual([candidateSignal1]);
      done();
    });
  });

  it('rejects answer having different provider', (done) => {
    var bob = bridge.preObfuscation();
    bob.negotiateConnection();
    bob.handleSignalMessage({
      signals: {
        'CHURN': []
      }
    });

    bob.signalForPeerQueue.setSyncHandler(
        (signal:bridge.SignallingMessage) => {
      expect(signal.errorOnLastMessage).toBeDefined();
      done();
    });
  });

  it('rejects offer from unknown provider', (done) => {
    var bob = bridge.best();
    bob.handleSignalMessage({
      signals: {
        'MAGIC': []
      }
    });

    bob.signalForPeerQueue.setSyncHandler(
        (signal:bridge.SignallingMessage) => {
      expect(signal.errorOnLastMessage).toBeDefined();
      done();
    });
  });

  it('onceConnected rejects if closed before negotiation', (done) => {
    var bob = bridge.best();
    bob.close();
    bob.onceConnected.catch(done);
  });

  it('onceClosed fulfills if closed before negotiation', (done) => {
    var bob = bridge.best();
    bob.close();
    bob.onceClosed.then(done);
  });
});
