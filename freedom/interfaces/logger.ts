// This file defines the API for uProxy's logging.
// For docs, see:
//   ../providers/logger.ts

/// <reference path="../../freedom/typings/freedom.d.ts" />
/// <reference path="../providers/logger.ts" />

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
fdom.apis.register('core.logging', UproxyLogging.FreedomLogManager);

fdom.apis.set('core.log', {
  'constructor': {
    value: ['string']
  },
  'debug': {
    type: 'method',
    value: ['object', ['array', 'object']]
  },
  'info': {
    type: 'method',
    value: ['object', ['array', 'object']]
  },
  'warn': {
    type: 'method',
    value: ['object', ['array', 'object']]
  },
  'error': {
    type: 'method',
    value: ['object', ['array', 'object']]
  }
});
fdom.apis.register('core.log', UproxyLogging.FreedomLogger);
