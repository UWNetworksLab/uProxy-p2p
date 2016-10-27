import * as freedomMocker from '../lib/freedom/mocks/mock-freedom-in-module-env';
import * as mockFreedomRtcPeerConnection from '../lib/freedom/mocks/mock-rtcpeerconnection';

import * as freedom_mocks from '../mocks/freedom-mocks';
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
});

var updates :{[name :string] :Function} = {};
var fakeFreedom = freedom();

var nextCommand = 12345;
var nextPromise = 12345;

import * as ui_connector from './ui_connector';
import UIConnector = ui_connector.UIConnector;
import * as uproxy_core_api from '../interfaces/uproxy_core_api';

describe('UIConnector', () => {
  var connector :UIConnector;

  beforeEach(() => {
    connector = new UIConnector();

    spyOn(fakeFreedom, 'on').and.callFake((name :string, callback :Function) => {
      updates[name] = callback;
    });
    spyOn(fakeFreedom, 'emit');
  });

  it('non-promise function', (done) => {
    var fn = () => { /* MT */ }
    var command = nextCommand++;

    connector.onCommand(command, fn);
    updates[command.toString()]({data: {}}).then(() => {
      expect(fakeFreedom.emit).not.toHaveBeenCalled();
      done();
    });
  });

  it('function returning nothing', (done) => {
    var fn = () => { /* MT */ }
    var command = nextCommand++;
    var promiseId = nextPromise++;

    connector.onCommand(command, fn);
    updates[command.toString()]({data: {}, promiseId: promiseId}).then(() => {
      expect(fakeFreedom.emit).toHaveBeenCalledWith(
          uproxy_core_api.Update.COMMAND_FULFILLED.toString(),
          jasmine.objectContaining({
            promiseId: promiseId
          })
      );
      done();
    });
  });

  it('function returinng unexpected value', (done) => {
    var fn = () => { return <any>true; }
    var command = nextCommand++;
    var promiseId = nextPromise++;

    connector.onCommand(command, fn);
    updates[command.toString()]({data: {}, promiseId: promiseId}).then(() => {
      expect(fakeFreedom.emit).toHaveBeenCalledWith(
          uproxy_core_api.Update.COMMAND_FULFILLED.toString(),
          jasmine.objectContaining({
            promiseId: promiseId,
            argsForCallback: true,
          })
      );
      done();
    });
  });

  it('function behaving correctly', (done) => {
    var fn = () => { return Promise.resolve(true); }
    var command = nextCommand++;
    var promiseId = nextPromise++;

    connector.onCommand(command, fn);
    updates[command.toString()]({data: {}, promiseId: promiseId}).then(() => {
      expect(fakeFreedom.emit).toHaveBeenCalledWith(
          uproxy_core_api.Update.COMMAND_FULFILLED.toString(),
          jasmine.objectContaining({
            promiseId: promiseId,
            argsForCallback: true,
          })
      );
      done();
    });
  });

  it('function throws exception', (done) => {
    var fn = () => { throw new Error(); };
    var command = nextCommand++;
    var promiseId = nextPromise++;

    connector.onCommand(command, fn);
    updates[command.toString()]({data: {}, promiseId: promiseId}).then(() => {
      expect(fakeFreedom.emit).toHaveBeenCalledWith(
          uproxy_core_api.Update.COMMAND_REJECTED.toString(),
          jasmine.objectContaining({
            promiseId: promiseId,
          })
      );
      done();
    });
  });
});
