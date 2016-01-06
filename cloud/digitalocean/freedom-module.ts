/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import Provisioner = require('./provisioner');

freedom().providePromises(Provisioner);

export = Provisioner
