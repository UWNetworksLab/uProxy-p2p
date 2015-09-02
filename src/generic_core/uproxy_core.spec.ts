/**
 * core.spec.ts
 *
 * There are a number of message types and interactions which prepare the
 * roster, clients, and instances. These have various caveats and edge cases,
 * and can also be received in different orders. This file lays out these
 * requirement and ensures consistency.
 */
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

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
  network['login'] = (reconnect :boolean) => { return Promise.resolve<void>() };
  network['myInstance'] =
            new local_instance.LocalInstance(network, 'localUserId');
  var user = new remote_user.User(network, 'fake-login');
  user.getInstance = null;
  user.notifyUI = () => {};
  user.getLocalInstanceId = () => { return 'fake/userpath'; };
  var alice = new remote_instance.RemoteInstance(user, 'instance-alice');
  // Mock out the probeProtocolSupport function.
  globals.portControl.probeProtocolSupport = () => {
    return Promise.resolve({"natPmp": false, "pcp": false, "upnp": false});
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

  it('relays incoming manual network messages to the manual network', () => {
    var manualNetwork :social_network.ManualNetwork =
        new social_network.ManualNetwork(social_network.MANUAL_NETWORK_ID);

    spyOn(social_network, 'getNetwork').and.returnValue(manualNetwork);
    spyOn(manualNetwork, 'receive');

    var senderClientId = 'dummy_sender';
    var message :social.VersionedPeerMessage = {
      type: social.PeerMessageType.SIGNAL_FROM_SERVER_PEER,
      data: {
        elephants: 'have trunks',
        birds: 'do not'
      },
      version: globals.MESSAGE_VERSION
    };
    var command :social.HandleManualNetworkInboundMessageCommand = {
      senderClientId: senderClientId,
      message: message
    };
    core.handleManualNetworkInboundMessage(command);

    expect(social_network.getNetwork).toHaveBeenCalledWith(social_network.MANUAL_NETWORK_ID, '');
    expect(manualNetwork.receive).toHaveBeenCalledWith(senderClientId, message);
  });

  it('login fails for invalid network', (done) => {
    core.login({network: 'nothing', reconnect: false}).catch(() => {
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
    core.login({network: 'mockNetwork', reconnect: false});
    expect(loginSpy).toHaveBeenCalled();

    // Core login will envoke login method on the same network object
    // This time it succeeds, so network object is moved from pending logins
    // to social_network.networks.
    loginSpy.and.returnValue(Promise.resolve());
    core.login({network: 'mockNetwork', reconnect: false}).then(() => {
      // should have called login on the same spy twice and only constructed
      // one network
      expect(loginSpy.calls.count()).toEqual(2);
      expect((<any>(social_network.FreedomNetwork)).calls.count()).toEqual(1);
    }).then(done);
  });
});
