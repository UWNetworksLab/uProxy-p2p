/// <reference path='../../../../third_party/typings/index.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
import MockFreedomEventHandler = require('../freedom/mocks/mock-eventhandler');
import loggingProviderTypes = require('../loggingprovider/loggingprovider.types');
import Logging = require('./logging');

declare var freedom: freedom.FreedomInModuleEnv;

describe('Client logging shim using Freedom', () => {
  var logginglistener :MockFreedomEventHandler;

  beforeEach(() => {
    // Reset the mock freedom environment.
    freedom = freedomMocker.makeMockFreedomInModuleEnv({
      'logginglistener': () => {
        logginglistener = new MockFreedomEventHandler(['levelchange']);
        return logginglistener;
      }
    });
  });

  describe('tag tests', () => {
    it('Get logger with tag tag1', (done) => {
      var mockLoggerPromise = Promise.resolve(jasmine.createSpyObj(
        'tag1', ['debug', 'log', 'info', 'warn', 'error']));
      var getLoggerSpy = spyOn(freedom.core(), 'getLogger');
      getLoggerSpy.and.returnValue(mockLoggerPromise);

      var log1 = new Logging.Log('tag1');
      expect(getLoggerSpy).toHaveBeenCalledWith('tag1');
      done();
    });

    it('Get logger with tag tag2', (done) => {
      var mockLoggerPromise = Promise.resolve(jasmine.createSpyObj(
        'tag1', ['debug', 'log', 'info', 'warn', 'error']));
      var getLoggerSpy = spyOn(freedom.core(), 'getLogger');
      getLoggerSpy.and.returnValue(mockLoggerPromise);

      var log2 = new Logging.Log('tag2');
      expect(getLoggerSpy).not.toHaveBeenCalledWith('tag1');
      expect(getLoggerSpy).toHaveBeenCalledWith('tag2');
      done();
    });
  });

  describe('Log messages', () => {
    var mockLoggerPromise :Promise<freedom.Logger>;
    var log :Logging.Log;

    beforeEach(() => {
      var mockLogger = jasmine.createSpyObj<freedom.Logger>('tag',
          ['debug', 'log', 'info', 'warn', 'error']);
      mockLoggerPromise = Promise.resolve(mockLogger);

      spyOn(freedom.core(), 'getLogger').and.returnValue(mockLoggerPromise);

      log = new Logging.Log('tag');
    });

    it('A new Logging.Log forwards all logging to the named freedom core logger.',
        (done) => {
      log.error('test-error-string');
      log.debug('test-debug-string');

      mockLoggerPromise.then((mockLogger :freedom.Logger) => {
        expect(mockLogger.debug).toHaveBeenCalledWith('test-debug-string');
        expect(mockLogger.error).toHaveBeenCalledWith('test-error-string');
        expect(mockLogger.log).not.toHaveBeenCalledWith('test-error-string');
        done();
      });
    });

    it('Collapses array argument into flattened messages', (done) => {
      log.info('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);

      mockLoggerPromise.then((mockLogger :freedom.Logger) => {
        expect(mockLogger.info)
          .toHaveBeenCalledWith('Bob pinged Alice with id=123456');
        done();
      });
    });

    it('Collpases arguments into flattened messages', (done) => {
      log.info('%1 pinged %2 with id=%3', 'Bob', 'Alice', '123456');
      mockLoggerPromise.then((mockLogger :freedom.Logger) => {
        expect(mockLogger.info)
          .toHaveBeenCalledWith('Bob pinged Alice with id=123456');
        done();
      });
    });

    it('Adds unspecified arguments to the end', (done) => {
      log.info('%1', 'foo', 'bar');
      mockLoggerPromise.then((mockLogger :freedom.Logger) => {
        expect(mockLogger.info).toHaveBeenCalledWith('foo bar');
        done();
      });
    });

    it('stringify objects', (done) => {
      var obj = { foo: 'bar' };

      log.info('%1', obj);

      mockLoggerPromise.then((mockLogger :freedom.Logger) => {
        expect(mockLogger.info).toHaveBeenCalledWith(JSON.stringify(obj));
        done();
      });
    });

    it('handles recursive objects', (done) => {
      var obj :any = { property: 'value' };
      obj.pts = obj;

      log.info(obj);

      mockLoggerPromise.then((mockLogger :freedom.Logger) => {
        expect((<jasmine.Spy>mockLogger.info).calls.mostRecent().args[0]).toMatch(/property/);
        done();
      });
    });

    it('responds to level changes', (done) => {
      logginglistener.handleEvent('levelchange', loggingProviderTypes.Level.warn);

      log.info('this is a test');
      log.warn('this is not a test');

      mockLoggerPromise.then((mockLogger :freedom.Logger) => {
        expect(mockLogger.info).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalled();
        done();
      });
    });
  });

});
