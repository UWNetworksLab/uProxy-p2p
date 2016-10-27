import AbstractProxyIntegrationTest from './proxy-integration-test';
import * as loggingTypes from '../../loggingprovider/loggingprovider.types';

declare const freedom: freedom.FreedomInModuleEnv;

// Example of how to set custom logging level: we set everything to debug for
// testing echo server.
var loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

if (typeof freedom !== 'undefined') {
  freedom().providePromises(AbstractProxyIntegrationTest);
}
