/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import CloudInstaller = require('./installer');

freedom().providePromises(CloudInstaller);

export = CloudInstaller
