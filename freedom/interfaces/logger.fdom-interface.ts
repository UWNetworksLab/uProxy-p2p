// This file defines the API for uProxy's logging.
// For docs, see:
//   ../providers/logger.ts

/// <reference path="../../freedom/typings/freedom.d.ts" />
/// <reference path="../coreproviders/uproxylogging.d.ts" />

declare var fdom:freedom.CoreProviderEnv.Fdom;

fdom.apis.set('core.logging', {
  'constructor': {
    value: []
  },
  'getEncrypedLogBuffer': {
    type: 'method',
    value: [['array', 'string']],
    ret: 'buffer'
  },
  'getLogs': {
    type: 'method',
    value: [['array', 'string']],
    ret: ['array', 'string']
  },
  'clearLogs': {
    type: 'method',
    value: []
  },
  'enable': {
    type: 'method',
    value: []
  },
  'disable': {
    type: 'method',
    value: []
  },
  'setConsoleFilter': {
    type: 'method',
    value: [['array', 'string']]
  }
});
fdom.apis.register('core.logging', Freedom_UproxyLogging.LogManager);

fdom.apis.set('core.log', {
  'constructor': {
    value: ['string']
  },
  'debug': {
    type: 'method',
    value: ['string', ['array', 'object']]
  },
  'info': {
    type: 'method',
    value: ['string', ['array', 'object']]
  },
  'warn': {
    type: 'method',
    value: ['string', ['array', 'object']]
  },
  'error': {
    type: 'method',
    value: ['string', ['array', 'object']]
  }
});
fdom.apis.register('core.log', Freedom_UproxyLogging.Log);
