/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import TurnFrontend = require('./turn-frontend');

if (typeof freedom !== 'undefined') {
  freedom['turnFrontend']().providePromises(TurnFrontend);
}
