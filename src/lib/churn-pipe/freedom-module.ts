/// <reference path='../../../../third_party/typings/browser.d.ts' />

import ChurnPipe = require('./churn-pipe');

declare const freedom: freedom.FreedomInModuleEnv;

if (typeof freedom !== 'undefined') {
  freedom['churnPipe']().providePromises(ChurnPipe);
}

export = ChurnPipe
