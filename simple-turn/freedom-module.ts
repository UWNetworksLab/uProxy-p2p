/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import turn_frontend = require('../turn-frontend/turn-frontend');
import turn_backend = require('../turn-backend/turn-backend');

import net = require('../net/net.types');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');

var loggingController = freedom['loggingcontroller']();
loggingController = loggingController.setDefaultFilter(
    loggingTypes.Destination.console,
    loggingTypes.Level.debug);

var log :logging.Log = new logging.Log('simple TURN');

var frontend: turn_frontend.Frontend = new turn_frontend.Frontend();
var backend: turn_backend.Backend = new turn_backend.Backend();

frontend.setIpcHandler(backend.handleIpc);
backend.setIpcHandler(frontend.handleIpc);

frontend.bind('127.0.0.1', 9997).catch((e:Error) => {
  log.error('failed to start TURN frontend: ' + e.message);
});
