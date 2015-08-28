/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import ChurnPipe = require('./churn-pipe');

if (typeof freedom !== 'undefined') {
  freedom['churnPipe']().providePromises(ChurnPipe);
}

export = ChurnPipe
