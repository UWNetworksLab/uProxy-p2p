/// <reference path='../../../../third_party/typings/index.d.ts' />

import provider = require('./provider');

declare const freedom: freedom.FreedomInModuleEnv;

if (typeof freedom !== 'undefined') {
  freedom().providePromises(provider.CloudSocialProvider);
}
