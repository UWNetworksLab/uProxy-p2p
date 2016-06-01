/// <reference path='../../../../third_party/typings/browser.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.rtcpeerconnection': () => { return new mockFreedomRtcPeerConnection(); }
});

import bridge = require('./bridge');
import datachannel = require('../webrtc/datachannel');
import handler = require('../handler/queue');
import mockFreedomRtcPeerConnection = require('../freedom/mocks/mock-rtcpeerconnection');
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

////////
// Static helpers.
////////

describe('isTerminatingSignal', function() {
  it('ignores messages without signals', () => {
    expect(bridge.isTerminatingSignal({
      errorOnLastMessage: true
    })).toBeFalsy();
  });

  it('handles non-terminating PLAIN signal', () => {
    expect(bridge.isTerminatingSignal({
      signals: {
        PLAIN: [
          {
            type: peerconnection_types.Type.CANDIDATE
          }
        ]
      }
    })).toBeFalsy();
  });

  it('handles terminating PLAIN signal', () => {
    expect(bridge.isTerminatingSignal({
      signals: {
        PLAIN: [
          {
            type: peerconnection_types.Type.NO_MORE_CANDIDATES
          }
        ]
      }
    })).toBeTruthy();
  });

  it('handles non-terminating CHURN signal', () => {
    expect(bridge.isTerminatingSignal({
      signals: {
        CHURN: [
          {
            caesar: 94
          }
        ]
      }
    })).toBeFalsy();
  });

  it('handles terminating CHURN signal', () => {
    expect(bridge.isTerminatingSignal({
      signals: {
        CHURN: [
          {
            webrtcMessage: {
              type: peerconnection_types.Type.NO_MORE_CANDIDATES
            }
          }
        ]
      }
    })).toBeTruthy();
  });

  it('rejects multiple providers', () => {
    expect(() => {
      bridge.isTerminatingSignal({
        signals: {
          CHURN: [
            {
              caesar: 94
            }
          ],
          HOLO_ICE: [
            {
              caesar: 94
            }
          ]
        }
      });
    }).toThrow();
  });

  it('rejects multiple signals', () => {
    expect(() => {
      bridge.isTerminatingSignal({
        signals: {
          CHURN: [
            {
              caesar: 94
            },
            {
              caesar: 94
            }
          ]
        }
      });
    }).toThrow();
  });
});

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
