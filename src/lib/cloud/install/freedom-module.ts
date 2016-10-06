/// <reference path='../../../../third_party/typings/index.d.ts' />

import CloudInstaller from './installer';

declare const freedom: freedom.FreedomInModuleEnv;

freedom().providePromises(CloudInstaller);

export default CloudInstaller;
