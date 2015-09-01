/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');
import nat_probe = require('../nat/probe');

export var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

var log :logging.Log = new logging.Log('probe');

nat_probe.probe().then((type:string) => {
  log.info('NAT type: %1', type);
}, (e:Error) => {
  log.error('could not probe NAT: %1', e.message);
});
