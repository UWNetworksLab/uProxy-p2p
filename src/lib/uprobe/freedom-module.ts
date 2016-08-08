/// <reference path='../../../third_party/typings/index.d.ts' />

import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import nat_probe = require('../nat/probe');

declare const freedom: freedom.FreedomInModuleEnv;

export var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

var log :logging.Log = new logging.Log('probe');

nat_probe.probe().then((type:string) => {
  log.info('NAT type: %1', type);
}, (e:Error) => {
  log.error('could not probe NAT: %1', e.message);
});
