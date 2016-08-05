/// <reference path='../../../../../third_party/typings/index.d.ts' />

import Provisioner = require('./provisioner');

declare const freedom: freedom.FreedomInModuleEnv;

freedom().providePromises(Provisioner);

export = Provisioner
