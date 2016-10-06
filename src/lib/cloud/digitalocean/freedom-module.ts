/// <reference path='../../../../third_party/typings/index.d.ts' />

import Provisioner from './provisioner';

declare const freedom: freedom.FreedomInModuleEnv;

freedom().providePromises(Provisioner);

export default Provisioner;
