/// <reference path='../../../../third_party/typings/index.d.ts' />

import * as provider from './provider';

declare const freedom: freedom.FreedomInModuleEnv;

if (typeof freedom !== 'undefined') {
  freedom().providePromises(provider.CloudSocialProvider);
}
