/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import logging = require('../../logging/logging');
import loggingTypes = require('../../loggingprovider/loggingprovider.types');

const loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

const log :logging.Log = new logging.Log('deployer');

const digitalOcean = freedom['digitalocean']();

digitalOcean.on('status', (msg:any) => {
  log.info('status: %1', msg.message);
});

log.info('deploying...');

digitalOcean.start('test').then((ret: any) => {
  log.info('final result: %1', ret);
}, (e:Error) => {
  log.error('failed to deploy: %1', e);
});
