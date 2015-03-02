/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
import freedomTypes = require('freedom.types');
import Logging = require('./logging');

describe('Client logging shim using Freedom', () => {
  beforeEach(() => {
    // Reset the mock freedom environment.
    freedom = freedomMocker.makeMockFreedomInModuleEnv();
  });

  describe('tag tests', () => {
    it('Get logger with tag tag1', (done) => {
      var mockLoggerPromise = Promise.resolve(jasmine.createSpyObj(
        'tag1', ['debug', 'log', 'info', 'warn', 'error']));
      var getLoggerSpy = spyOn(freedom.core(), "getLogger");
      getLoggerSpy.and.returnValue(mockLoggerPromise);

      var log1 = new Logging.Log('tag1');
      expect(getLoggerSpy).toHaveBeenCalledWith('tag1');
      done();
    });

    it('Get logger with tag tag2', (done) => {
      var mockLoggerPromise = Promise.resolve(jasmine.createSpyObj(
        'tag1', ['debug', 'log', 'info', 'warn', 'error']));
      var getLoggerSpy = spyOn(freedom.core(), "getLogger");
      getLoggerSpy.and.returnValue(mockLoggerPromise);

      var log2 = new Logging.Log('tag2');
      expect(getLoggerSpy).not.toHaveBeenCalledWith('tag1');
      expect(getLoggerSpy).toHaveBeenCalledWith('tag2');
      done();
    });
  });

  describe('Log messages', () => {
    var mockLoggerPromise :Promise<freedomTypes.Logger>;

    beforeEach(() => {
      var mockLogger = jasmine.createSpyObj<freedomTypes.Logger>('tag',
          ['debug', 'log', 'info', 'warn', 'error']);
      mockLoggerPromise = Promise.resolve(mockLogger);

      spyOn(freedom.core(), 'getLogger').and.returnValue(mockLoggerPromise);
    });

    it('A new Logging.Log forwards all logging to the named freedom core logger.',
        (done) => {
      var log = new Logging.Log('tag');

      log.error('test-error-string');
      log.debug('test-debug-string');

      mockLoggerPromise.then((mockLogger :freedomTypes.Logger) => {
        expect(mockLogger.debug).toHaveBeenCalledWith('test-debug-string');
        expect(mockLogger.error).toHaveBeenCalledWith('test-error-string');
        expect(mockLogger.log).not.toHaveBeenCalledWith('test-error-string');
        done();
      });
    });

    it('Collapses array argument into flattened messages', (done) => {
      var log = new Logging.Log('tag');

      log.info('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);

      mockLoggerPromise.then((mockLogger :freedomTypes.Logger) => {
        expect(mockLogger.info)
          .toHaveBeenCalledWith('Bob pinged Alice with id=123456');
        done();
      });
    });

    it('Collpases arguments into flattened messages', (done) => {
      var log = new Logging.Log('tag');

      log.info('%1 pinged %2 with id=%3', 'Bob', 'Alice', '123456');
      mockLoggerPromise.then((mockLogger :freedomTypes.Logger) => {
        expect(mockLogger.info)
          .toHaveBeenCalledWith('Bob pinged Alice with id=123456');
        done();
      });
    });

    it('Adds unspecified arguments to the end', (done) => {
      var log = new Logging.Log('tag');

      log.info('%1', 'foo', 'bar');
      mockLoggerPromise.then((mockLogger :freedomTypes.Logger) => {
        expect(mockLogger.info).toHaveBeenCalledWith('foo bar');
        done();
      });
    });

    it('stringify objects', (done) => {
      var log = new Logging.Log('tag');
      var obj = { foo: 'bar' };

      log.info('%1', obj);

      mockLoggerPromise.then((mockLogger :freedomTypes.Logger) => {
        expect(mockLogger.info).toHaveBeenCalledWith(JSON.stringify(obj));
        done();
      });
    });

  });

});
