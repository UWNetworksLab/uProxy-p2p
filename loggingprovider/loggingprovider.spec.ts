/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../freedom/typings/freedom-module-env.d.ts' />

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
  return new freedomMocker.SkeletonFreedomConsole();
}

// We need to mock freedom before the LoggingProvider import, because the
// import/require statement that loads |LoggingProvider| will call
// freedom['core.console'] (we need to first ensure it is defined!).
freedom = freedomMocker.makeSkeletonFreedomInModuleEnv({
  'core.console': mockFreedomCoreConsoleObjFn,
  'loggingcontroller': () => {
    return new freedomMocker.SkeletonModuleSelfConstructor();
  }
});

import logging = require('loggingprovider.types');
import LoggingProvider = require('./loggingprovider');

describe("Logging Provider", () => {
  var logger :logging.Log;
  var loggingControl :logging.Controller;

  var message1 = LoggingProvider.makeMessage('D', 'tag', 'simple string');
  var message3 = LoggingProvider.makeMessage('I', 'test-module', 'second string');
  var message4 = LoggingProvider.makeMessage('W', 'test', 'Bob pinged Alice with id=123456');
  var message5 = LoggingProvider.makeMessage('E', 'test', 'Bob pinged Alice with id=123456');

  beforeEach(() => {
    logger = new LoggingProvider.Log();
    loggingControl = new LoggingProvider.LoggingController();
    loggingControl.clearLogs();
  });

  it('Logging provider static format functions', () => {
    expect(LoggingProvider.formatMessage(message1))
        .toMatch(/D \[.*\] simple string/);
    expect(LoggingProvider.formatMessage(message3))
        .toMatch(/I \[.*\] second string/);
    expect(LoggingProvider.formatMessage(message4))
        .toMatch(/W \[.*\] Bob pinged Alice with id=123456/);
    expect(LoggingProvider.formatMessage(message5))
        .toMatch(/E \[.*\] Bob pinged Alice with id=123456/);
  });

  it('Log calls result in logs in the logging provider', () => {
    // testing default behavior, only log error messages.
    logger.debug('tag1', 'simple string');
    logger.info('tag1', 'second string');
    logger.error('tag1', 'third string');
    expect(loggingControl.getLogs().join('\n')).toMatch(
      /E \[.*\] third string/);

    // set to log all messages.
    loggingControl.clearLogs();
    loggingControl.setBufferedLogFilter(['*:D']);
    logger.debug('tag1', 'simple string');
    logger.info('tag1', 'second string');
    logger.error('tag1', 'third string');
    expect(loggingControl.getLogs().join('\n')).toMatch(
      /D \[.*\] simple string\nI \[.*\] second string\nE \[.*\] third string/);

     // set to log messages with level >= info.
    loggingControl.clearLogs();
    loggingControl.setBufferedLogFilter(['*:I']);
    logger.debug('tag1', 'simple string');
    logger.info('tag2', 'second string');
    logger.error('tag3', 'third string');
    expect(loggingControl.getLogs().join('\n')).toMatch(
      /I \[.*\] second string\nE \[.*\] third string/);

    // restore back to default.
    loggingControl.setBufferedLogFilter(['*:E']);
  });
});
