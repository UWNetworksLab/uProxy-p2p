/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import provider = require('./provider');

if (typeof freedom !== 'undefined') {
  freedom().providePromises(provider.CloudSocialProvider);
}
