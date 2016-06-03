/// <reference path='../../../../third_party/typings/browser.d.ts' />

import CloudInstaller = require('./installer');

declare const freedom: freedom.FreedomInModuleEnv;

freedom().providePromises(CloudInstaller);

export = CloudInstaller
