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

  'negotiateConnection': {
    type: 'method',
    value: [],
    ret: {
      'localAddress': 'string',
      'localPort': 'number',
      'remoteAddress': 'string',
      'remotePort': 'number'
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
  }
});
