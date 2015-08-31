/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import turn_frontend = require('../turn-frontend/freedom-module.interface');
import turn_backend = require('../turn-backend/freedom-module.interface');

import net = require('../net/net.types');
import logging = require('../logging/logging');
import loggingTypes = require('../loggingprovider/loggingprovider.types');

var loggingController = freedom['loggingcontroller']();
loggingController = loggingController.setDefaultFilter(
    loggingTypes.Destination.console,
    loggingTypes.Level.debug);

var log :logging.Log = new logging.Log('simple TURN');

var frontend :turn_frontend.freedom_TurnFrontend = freedom['turnFrontend']();
var backend :turn_backend.freedom_TurnBackend = freedom['turnBackend']();

frontend.bind('127.0.0.1', 9997).then(() => {
  // Connect the TURN server with the net module.
  // Normally, these messages would traverse the internet
  // along an encrypted channel.
  frontend.on('ipc', function(m:turn_frontend.IpcEventMessage) {
    backend.handleIpc(m.data).catch((e) => {
      log.error('backend failed to handle ipc: ' + e.message);
    });
  });
  backend.on('ipc', function(m:turn_backend.IpcEventMessage) {
    frontend.handleIpc(m.data).catch((e) => {
      log.error('frontend failed to handle ipc: ' + e.message);
    })
  });
}, (e) => {
  log.error('failed to start TURN frontend: ' + e.message);
});
