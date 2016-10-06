/// <reference path='../../../third_party/typings/index.d.ts' />

import * as logging from '../logging/logging';
import * as loggingTypes from '../loggingprovider/loggingprovider.types';
import * as nat_probe from '../nat/probe';

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
