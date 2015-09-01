/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom.d.ts' />

// Setup freedom mock environment.
import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');

// We need null mock freedom console (not one that raises errors). The
// loggingprovider in this file ignore freedom's calls to the core console
// provider.
//
// TODO: support adding the close param to the function object. Or persuade
// freedom to improve its namespace management.
//   mockFreedomCoreConsoleObjFn.close = (f:freedom_Console.Console) => {};
var mockFreedomCoreConsoleObjFn = () => {
  return new freedomMocker.MockFreedomConsole();
}

// We need to mock freedom before the LoggingProvider import, because the
// import/require statement that loads |LoggingProvider| will call
// freedom['core.console'] (we need to first ensure it is defined!).
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.console': mockFreedomCoreConsoleObjFn,
  'loggingcontroller': () => {
    return new freedomMocker.MockModuleSelfConstructor();
  }
});

import logging = require('./loggingprovider.types');
import LoggingProvider = require('./loggingprovider');

describe("Logging Provider", () => {
  var logger :logging.Log;
  var loggingControl :logging.Controller;

  beforeEach(() => {
    logger = new LoggingProvider.Log();
    loggingControl = new LoggingProvider.LoggingController();
    loggingControl.setFilters(logging.Destination.buffered, {});
    loggingControl.setDefaultFilter(logging.Destination.buffered,
                                    logging.Level.error);
    loggingControl.clearLogs();
  });

  it('Log calls result in logs in the logging provider', () => {
    // testing default behavior, only log error messages.
    logger.debug('tag1', 'simple string');
    logger.info('tag1', 'second string');
    logger.error('tag1', 'third string');
    expect(loggingControl.getLogs().join('\n')).toMatch(
      /third string/);
    expect(loggingControl.getLogs().join('\n')).not.toMatch(
      /second string/);

    // set to log all messages.
    loggingControl.clearLogs();
    loggingControl.setDefaultFilter(logging.Destination.buffered,
                                    logging.Level.debug);
    logger.debug('tag1', 'simple string');
    logger.info('tag1', 'second string');
    logger.error('tag1', 'third string');
    expect(loggingControl.getLogs().join('\n')).toMatch(
      /simple string\n.*second string\n.*third string/);

     // set to log messages with level >= info.
    loggingControl.clearLogs();
    loggingControl.setDefaultFilter(logging.Destination.buffered,
                                    logging.Level.info);
    logger.debug('tag1', 'simple string');
    logger.info('tag2', 'second string');
    logger.error('tag3', 'third string');
    expect(loggingControl.getLogs().join('\n')).toMatch(
      /second string\n.*third string/);
    expect(loggingControl.getLogs().join('\n')).not.toMatch(
      /simple string/);

  });

  it('Specific filtering level for tag overrides default', () => {
    var logs :string;
    loggingControl.clearLogs();
    loggingControl.setDefaultFilter(logging.Destination.buffered,
                                    logging.Level.debug);
    loggingControl.setFilters(logging.Destination.buffered, {
                                'tag2': logging.Level.info
                              });
    logger.debug('tag1', 'first string');
    logger.debug('tag2', 'second string');
    logger.info('tag3', 'third string');

    logs = loggingControl.getLogs().join('\n');

    expect(logs).not.toMatch(/second string/);
    expect(logs).toMatch(/first string/);
    expect(logs).toMatch(/third string/);
  });
});
