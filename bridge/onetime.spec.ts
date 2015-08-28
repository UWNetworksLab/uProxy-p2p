/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import bridge = require('./bridge');
import onetime = require('./onetime');
import peerconnection = require('../webrtc/peerconnection');
import peerconnection_types = require('../webrtc/signals');
import signals = require('../webrtc/signals');

describe('signal flattening', function() {
  var m1 :bridge.SignallingMessage = {
    signals: {
      'HOLO_ICE': [
        {
          caesar: 94
        }
      ]
    },
    first: true
  };

  var m2 :bridge.SignallingMessage = {
    signals: {
      'HOLO_ICE': [
        {
          webrtcMessage: {
            type: signals.Type.NO_MORE_CANDIDATES
          }
        }
      ]
    }
  };

  it('identity', () => {
    expect(onetime.SignalBatcher.flatten_([m1])).toEqual(m1);
  });

  it('multiple messages', () => {
    expect(onetime.SignalBatcher.flatten_([m1, m2])).toEqual({
      signals: {
        'HOLO_ICE': [
          {
            caesar: 94
          },
          {
            webrtcMessage: {
              type: signals.Type.NO_MORE_CANDIDATES
            }
          }
        ]
      },
      first: true
    });
  });
});
