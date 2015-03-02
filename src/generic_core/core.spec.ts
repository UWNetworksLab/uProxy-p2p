/**
 * core.spec.ts
 *
 * There are a number of message types and interactions which prepare the
 * roster, clients, and instances. These have various caveats and edge cases,
 * and can also be received in different orders. This file lays out these
 * requirement and ensures consistency.
 */
/// <reference path='core.ts' />
/// <reference path='social.ts' />
/// <reference path='../uproxy.ts' />
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

// declare var storage :Core.Storage;

describe('Core', () => {

  // Set up a fake network -> roster -> user -> instance chain.
  var network = <Social.Network><any>jasmine.createSpy('network');
  network.getUser = null;
  network['login'] = (remember:boolean) => { return Promise.resolve<void>() };
  var user = <Core.User><any>jasmine.createSpy('user');
  user.getInstance = null;
  user.notifyUI = () => {};
  user.getLocalInstanceId = () => { return 'fake/userpath'; };
  var alice = new Core.RemoteInstance(user, 'instance-alice', {
    instanceId: 'instance-alice',
    keyHash:    'fake-hash-alice',
    description: 'alice peer',
  });

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
  });

  it('passes modifyConsent to the correct instance', () => {
    spyOn(Social, 'getNetwork').and.callFake(() => {
      return network;
    });
    spyOn(network, 'getUser').and.callFake(() => {
      return user;
    });
    spyOn(user, 'getInstance').and.callFake(() => {
      return alice;
    });
    spyOn(alice, 'modifyConsent');
    var command :uProxy.ConsentCommand = {
      path: {
        network: {
          name: 'fake-network',
          userId: 'fake-login'
        },
        userId: 'user-alice',
        instanceId: 'instance-alice'
      },
      action: uProxy.UserAction.REQUEST
    };
    core.modifyConsent(command);
    expect(Social.getNetwork).toHaveBeenCalledWith('fake-network', 'fake-login');
    expect(network.getUser).toHaveBeenCalledWith('user-alice');
    expect(user.getInstance).toHaveBeenCalledWith('instance-alice');
    expect(alice.modifyConsent).toHaveBeenCalledWith(uProxy.UserAction.REQUEST);
  });

  it('relays incoming manual network messages to the manual network', () => {
    var manualNetwork :Social.ManualNetwork =
        new Social.ManualNetwork(Social.MANUAL_NETWORK_ID);

    spyOn(Social, 'getNetwork').and.returnValue(manualNetwork);
    spyOn(manualNetwork, 'receive');

    var senderClientId = 'dummy_sender';
    var message :uProxy.Message = {
      type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
      data: {
        elephants: 'have trunks',
        birds: 'do not'
      }
    };
    var command :uProxy.HandleManualNetworkInboundMessageCommand = {
      senderClientId: senderClientId,
      message: message
    };
    core.handleManualNetworkInboundMessage(command);

    expect(Social.getNetwork).toHaveBeenCalledWith(Social.MANUAL_NETWORK_ID, '');
    expect(manualNetwork.receive).toHaveBeenCalledWith(senderClientId, message);
  });

  it('login fails for invalid network', (done) => {
    core.login('nothing').catch(() => {
      expect(console.warn).toHaveBeenCalled();
      done();
    });
  });

  it('login continues to call login on correct network', (done) => {
    Social.networks['mockNetwork'] = {};
    spyOn(Social, 'FreedomNetwork').and.callFake(() => {
      network.myInstance = new Core.LocalInstance(network, 'fakeUser');
      return network;
    });
    expect(Object.keys(Social.pendingNetworks).length).toEqual(0);
    expect(Object.keys(Social.networks['mockNetwork']).length).toEqual(0);

    // Login promise is not resolved so network object stays in pending logins
    var loginSpy = spyOn(network, 'login').and.returnValue(
        new Promise((F, R) => {}));
    core.login('mockNetwork');
    expect(Object.keys(Social.pendingNetworks).length).toEqual(1);
    expect(Object.keys(Social.networks['mockNetwork']).length).toEqual(0);

    // Core login will envoke login method on the same network object
    // This time it succeeds, so network object is moved from pending logins
    // to Social.networks.
    (<any>loginSpy).and.callFake(() => {
      return Promise.resolve();
    });
    core.login('mockNetwork').then(() => {
      expect(Object.keys(Social.pendingNetworks).length).toEqual(0);
      expect(Object.keys(Social.networks['mockNetwork']).length).toEqual(1);
    }).then(done);
  });
});
