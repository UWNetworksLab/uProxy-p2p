/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import TurnBackend = require('./turn-backend');

if (typeof freedom !== 'undefined') {
  freedom['turnBackend']().providePromises(TurnBackend);
}
