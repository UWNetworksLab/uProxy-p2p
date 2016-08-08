/// <reference path='../../../../third_party/typings/index.d.ts' />

import CloudInstaller = require('./installer');

declare const freedom: freedom.FreedomInModuleEnv;

freedom().providePromises(CloudInstaller);

export = CloudInstaller
