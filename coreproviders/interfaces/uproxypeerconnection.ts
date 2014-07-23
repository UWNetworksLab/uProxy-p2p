// This file defines the API for uProxy's peerconnection Freedom module.
// It should be incorporated as part of re-building Freedom in order
// for it to be made available as a core provider.
// For docs, see:
//   ../providers/uproxypeerconnection.ts
declare var fdom:any;
fdom.apis.set('core.uproxypeerconnection', {
  'constructor': {
    value: [
      'string'
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
    value: [{
      'message': 'string'
    }]
  },

  'signalMessage': {
    type: 'event',
    value: {
      'message': 'string'
    }
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
    value: {
      'channelLabel': 'string'
    }
  },

  'fromPeerData': {
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
