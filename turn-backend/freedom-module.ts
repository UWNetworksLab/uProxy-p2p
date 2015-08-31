/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import TurnBackend = require('./turn-backend');

if (typeof freedom !== 'undefined') {
  freedom['turnBackend']().providePromises(TurnBackend);
}
