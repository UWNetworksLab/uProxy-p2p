// This file defines the API for uProxy's peerconnection Freedom module.
// It should be incorporated as part of re-building Freedom in order
// for it to be made available as a core provider.
// For docs, see:
//   ../providers/uproxypeerconnection.ts

/// <reference path="../../freedom-declarations/freedom.d.ts" />

declare var fdom:freedom.CoreProviderEnv.Fdom;

fdom.apis.set('core.uproxypeerconnection', {
  'constructor': {
    value: [
      'object'
    ]
  },

  ////////
  // Signalling channel.
  ////////

  'negotiateConnection': {
    type: 'method',
    value: [],
    ret: {
      'local': {
        'address': 'string',
        'port': 'number'
      },
      'remote': {
        'address': 'string',
        'port': 'number'
      }
    }
  },

  'handleSignalMessage': {
    type: 'method',
    value: 'object'
  },

  'signalMessageForPeer': {
    type: 'event',
    value: 'object'
  },

  'onceConnected': {
    type: 'method',
    value: [],
    ret: {
      'local': {
        'address': 'string',
        'port': 'number'
      },
      'remote': {
        'address': 'string',
        'port': 'number'
      }
    }
  },

  'onceConnecting': {
    type: 'method',
    value: []
  },

  'onceDisconnected': {
    type: 'method',
    value: []
  },

  ////////
  // Data channels.
  ////////

  'openDataChannel': {
    type: 'method',
    value: [
      'string'
    ]
  },

  'peerCreatedChannel': {
    type: 'event',
    value: 'string'
  },

  'dataFromPeer': {
    type: 'event',
    value: {
      'channelLabel': 'string',
      'message': {
        'str': 'string',
        'buffer': 'buffer'
      }
    }
  },

  'send': {
    type: 'method',
    value: [
      'string',
      {
        'str': 'string',
        'buffer': 'buffer'
      }
    ]
  }
});
