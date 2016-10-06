/// <reference path='../../../third_party/typings/index.d.ts' />

import ChurnPipe from './churn-pipe';

declare const freedom: freedom.FreedomInModuleEnv;

if (typeof freedom !== 'undefined') {
  freedom['churnPipe']().providePromises(ChurnPipe);
}

export = ChurnPipe
