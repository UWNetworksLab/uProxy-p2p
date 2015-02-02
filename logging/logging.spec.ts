/// <reference path='../../build/third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../freedom/typings/freedom-module-env.d.ts' />

import freedomMocker = require('../freedom/mocks/jasmine-mock-freedom-module-env');
import Logging = require('./logging');

describe("Client logging shim using Freedom", () => {

  beforeEach(() => {
    // Reset the mock freedom environment.
    freedom = freedomMocker.makeAbstractFreedomInModuleEnv();
  });

  it('A new Logging.Log forwards all logging to the named freedom core logger.',
      (done) => {
    var mockLoggerPromise = Promise.resolve(jasmine.createSpyObj(
      'tag1', ['debug', 'log', 'info', 'warn', 'error']));
    var mockGetLogger = spyOn(freedom.core(), "getLogger");
    mockGetLogger.and.returnValue(mockLoggerPromise);

    var log1 = new Logging.Log('tag1');
    expect(mockGetLogger).toHaveBeenCalledWith('tag1');

    log1.error('test-error-string');
    log1.debug('test-debug-string');

    mockLoggerPromise.then((mockLogger) => {
      expect(mockLogger.debug).toHaveBeenCalledWith('test-debug-string');
      expect(mockLogger.error).toHaveBeenCalledWith('test-error-string');
      expect(mockLogger.log).not.toHaveBeenCalledWith('test-error-string');
      done();
    });
  });

  it('Collapses arguments into flattened messages', (done) => {
    var mockLoggerPromise = Promise.resolve(jasmine.createSpyObj(
      'tag1', ['debug', 'log', 'info', 'warn', 'error']));
    var mockGetLogger = spyOn(freedom.core(), "getLogger");
    mockGetLogger.and.returnValue(mockLoggerPromise);

    var log2 = new Logging.Log('tag2');
    log2.info('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);
    expect(mockGetLogger).not.toHaveBeenCalledWith('tag1');
    expect(mockGetLogger).toHaveBeenCalledWith('tag2');

    mockLoggerPromise.then((mockLogger) => {
      expect(mockLogger.info)
        .toHaveBeenCalledWith('Bob pinged Alice with id=123456');
      done();
    });
  });

});
