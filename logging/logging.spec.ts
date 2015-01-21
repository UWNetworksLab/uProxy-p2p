/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />

import freedomMocker = require('../../third_party/typings/freedom/mocks/jasmine-mock-freedom-module-env');
import Logging = require('./logging');
import freedomVar = require('../../third_party/typings/freedom/freedom-module-env');

var freedom = freedomVar;

// freedom must be defined in the top level because code that uses freedom
// assumes it is a top level varibale.

describe("Client Logging Shim", () => {

  beforeEach(() => {
    // Reset the freedom env.
    freedom = freedomMocker.makeMockFreedomInModuleEnv();
  });

  it('forwards logs to freedom', (done) => {
    var mockLogger = jasmine.createSpyObj(
      'tag1', ['debug', 'log', 'info', 'warn', 'error'])
    var getLoggerMock = spyOn(freedom.core(), "getLogger");
    getLoggerMock.and.returnValue(mockLogger);

    var log1 = new Logging.Log('tag1');
    expect(getLoggerMock).toHaveBeenCalledWith('tag1');

    log1.error('test-error-string');
    log1.debug('test-debug-string');

    // Timeout is used to make sure the the promise resolution
    // setTimeout(() => {
      expect(mockLogger.debug).toHaveBeenCalledWith('test-debug-string');
      expect(mockLogger.error).toHaveBeenCalledWith('test-error-string');
      expect(mockLogger.log).not.toHaveBeenCalledWith('test-error-string');
      done();
    // }, 0);
  });
/*
  it('Collapses arguments into flattened messages', (done) => {
    var freedom = freedomMocker.makeFakeFreedomInModuleEnv();
    var mockLogger = jasmine.createSpyObj(
      'tag1', ['debug', 'log', 'info', 'warn', 'error'])
    spyOn(freedom.core(), "getLogger").and.returnValue(mockLogger);

    var log2 = new Logging.Log('tag2');
    log2.info('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);
    expect(freedom.core().getLogger).toHaveBeenCalledWith('tag2');

    //setTimeout(() => {
      expect(mockLogger.info)
        .toHaveBeenCalledWith('Bob pinged Alice with id=123456');
      done();
    //}, 0);
  });
*/
});
