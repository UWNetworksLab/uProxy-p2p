/// <reference path='../../third_party/typings/index.d.ts' />

/**
 * core.spec.ts
 *
 * There are a number of message types and interactions which prepare the
 * roster, clients, and instances. These have various caveats and edge cases,
 * and can also be received in different orders. This file lays out these
 * requirement and ensures consistency.
 */

import freedomMocker = require('../lib/freedom/mocks/mock-freedom-in-module-env');

import freedom_mocks = require('../mocks/freedom-mocks');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'loggingcontroller': () => { return new freedom_mocks.MockLoggingController(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import globals = require('./globals');
import social = require('../interfaces/social');
import social_network = require('./social');
import remote_user = require('./remote-user');
import local_instance = require('./local-instance');
import remote_instance = require('./remote-instance');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import uproxy_core = require('./uproxy_core');

describe('Core', () => {

  // Set up a fake network -> roster -> user -> instance chain.
  var network = <social.Network><any>jasmine.createSpy('network');
  network.getUser = null;
  network.getStorePath = function() { return 'network-store-path'; };
  network['login'] = (loginType :uproxy_core_api.LoginType) => {
    return Promise.resolve();
  };
  network['myInstance'] =
            new local_instance.LocalInstance(network, 'localUserId');
  var user = new remote_user.User(network, 'fake-login');
  user.getInstance = null;
  user.notifyUI = () => {};
  user.getLocalInstanceId = () => { return 'fake/userpath'; };
  var alice = new remote_instance.RemoteInstance(user, 'instance-alice');
  // Mock out the probeProtocolSupport function.
  globals.portControl.probeProtocolSupport = () => {
    return Promise.resolve({'natPmp': false, 'pcp': false, 'upnp': false});
  };
  var core = new uproxy_core.uProxyCore();

  beforeEach(() => {
    spyOn(console, 'log');
  });

  it('passes modifyConsent to the correct user', () => {
    spyOn(social_network, 'getNetwork').and.callFake(() => {
      return network;
    });
    spyOn(network, 'getUser').and.callFake(() => {
      return user;
    });
    spyOn(user, 'modifyConsent');
    var command :uproxy_core_api.ConsentCommand = {
      path: {
        network: {
          name: 'fake-network',
          userId: 'fake-login'
        },
        userId: 'user-alice'
      },
      action: uproxy_core_api.ConsentUserAction.REQUEST
    };
    core.modifyConsent(command);
    expect(user.modifyConsent).toHaveBeenCalledWith(uproxy_core_api.ConsentUserAction.REQUEST);
  });

  it('login fails for invalid network', (done) => {
    core.login({network: 'nothing',
                loginType: uproxy_core_api.LoginType.INITIAL}).catch(() => {
      done();
    });
  });

  it('login continues to call login on correct network', (done) => {
    social_network.networks['mockNetwork'] = {};
    spyOn(social_network, 'FreedomNetwork').and.callFake(() => {
      network.myInstance = new local_instance.LocalInstance(network, 'fakeUser');
      return network;
    });

    // Login promise is not resolved so network object stays in pending logins
    var loginSpy = spyOn(network, 'login');
    loginSpy.and.returnValue(new Promise(() => {}));
    core.login({network: 'mockNetwork',
                loginType: uproxy_core_api.LoginType.INITIAL});
    expect(loginSpy).toHaveBeenCalled();

    // Core login will envoke login method on the same network object
    // This time it succeeds, so network object is moved from pending logins
    // to social_network.networks.
    loginSpy.and.returnValue(Promise.resolve());
    core.login({network: 'mockNetwork',
                loginType: uproxy_core_api.LoginType.INITIAL}).then(() => {
      // should have called login on the same spy twice and only constructed
      // one network
      expect(loginSpy.calls.count()).toEqual(2);
      expect((<any>(social_network.FreedomNetwork)).calls.count()).toEqual(1);
    }).then(done);
  });
});
