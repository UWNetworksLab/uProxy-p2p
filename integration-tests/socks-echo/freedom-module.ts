/// <reference path='../../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import AbstractProxyIntegrationTest = require('./proxy-integration-test');
import loggingTypes = require('../../loggingprovider/loggingprovider.types');

// Example of how to set custom logging level: we set everything to debug for
// testing echo server.
var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

if (typeof freedom !== 'undefined') {
  freedom().providePromises(AbstractProxyIntegrationTest);
}
