/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import freedomMocker = require('../../../third_party/uproxy-lib/freedom/mocks/mock-freedom-in-module-env');

import freedom_mocks = require('../mocks/freedom-mocks');
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import social = require('../interfaces/social');
import remote_user = require('./remote-user');
import remote_instance = require('./remote-instance');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import local_storage = require('./storage');
import consent = require('./consent');

import globals = require('./globals');
import storage = globals.storage;
import local_instance = require('./local-instance');

describe('remote_user.User', () => {
  // Prepare a fake Social.Network object to construct User on top of.
  var network = jasmine.createSpyObj('network', [
      'api',
      'getStorePath',
      'notifyUI'
  ]);
  network['getLocalInstanceId'] = function() { return 'dummyInstanceId'; };
  network['send'] = () => { return Promise.resolve(); };
  network['isEncrypted'] = () => { return false; };
  network['myInstance'] =
      new local_instance.LocalInstance(network, 'localUserId');

  var user :remote_user.User;
  var instance :remote_instance.RemoteInstance;

  it('creates with the correct userId', (done) => {
    user = new remote_user.User(network, 'fakeuser');
    expect(user.userId).toEqual('fakeuser');
    expect(user['network']).toEqual(network);
    storage.load(user.getStorePath()).catch((e) => {
      // User should not be in storage
      done();
    })
  });

  it('creates with pending name if there was no profile', () => {
    expect(user.name).toEqual('pending');
  });

  it('created with an empty client and instance tables', () => {
    expect(user.clientIdToStatusMap).toEqual({});
    expect(user['instances_']).toEqual({});
    expect(user['clientToInstanceMap_']).toEqual({});
    expect(user['instanceToClientMap_']).toEqual({});
  });

  describe('profile updates', () => {
    it('updates name', () => {
      user.update({
        name: 'Alice',
        userId: 'fakeuser',
        timestamp: 42
      });
      expect(user.name).toEqual('Alice');
    });

    it('throws exception for unexpected userid', () => {
      expect(() => {
        user.update({
          name: 'Alice',
          userId: 'very-throwy-userid',
          timestamp: 42
        });
      }).toThrow();
    });

  });

  it('sends an instance message to newly ONLINE clients', () => {
    spyOn(user, 'sendInstanceHandshake');
    var clientState :social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: social.ClientStatus.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(user.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient');
    expect(user.clientIdToStatusMap['fakeclient']).toEqual(social.ClientStatus.ONLINE);
  });

  it('does not re-send instance messages to the same client', () => {
    spyOn(user, 'sendInstanceHandshake');
    expect(user.clientIdToStatusMap['fakeclient']).toEqual(social.ClientStatus.ONLINE);
    var clientState :social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: social.ClientStatus.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(user.sendInstanceHandshake).not.toHaveBeenCalled();
  });

  it('does not add clients that are ONLINE_WITH_OTHER_APP', () => {
    var clientState :social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeNonUproxyClient',
      status: social.ClientStatus.ONLINE_WITH_OTHER_APP,
      timestamp: 12346
    };
    user.handleClient(clientState);
    expect(user.clientIdToStatusMap['fakeNonUproxyClient']).not.toBeDefined();
  });

  it('deletes DISCONNECTED client', () => {
    var clientState :social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: social.ClientStatus.OFFLINE,
      timestamp: 12346
    };
    user.handleClient(clientState);
    expect(user.clientIdToStatusMap['fakeclient']).not.toBeDefined();
  });

  it('re-adds an re-sends instance message to new ONLINE clients', () => {
    spyOn(user, 'sendInstanceHandshake');
    var clientState :social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: social.ClientStatus.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(user.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient');
    expect(user.clientIdToStatusMap['fakeclient']).toEqual(social.ClientStatus.ONLINE);
  });

  it('logs an error when receiving a ClientState with wrong userId', () => {
    var clientState :social.ClientState = {
      userId: 'fakeuserd',
      clientId: 'fakeclient',
      status: social.ClientStatus.ONLINE,
      timestamp: 12345
    };
    spyOn(console, 'error');
    user.handleClient(clientState);
    // TODO: check return value for error (there should be one)
  });

  describe('handlers', () => {
    it('handles an INSTANCE message', () => {
      spyOn(user, 'syncInstance_').and.returnValue(Promise.resolve());
      user.handleMessage('fakeclient', {
        type: social.PeerMessageType.INSTANCE,
        data: {
          instanceId: 'instanceId', description: '', publicKey: '',
          consent: {isOffering: false, isRequesting: false}
        },
        version: globals.MESSAGE_VERSION
      });
      expect(user.syncInstance_).toHaveBeenCalled();
    });

    it('handles a SIGNAL* messages', () => {
      var instance = jasmine.createSpyObj('instance', ['handleSignal']);
      spyOn(user, 'clientToInstance');
      spyOn(user, 'getInstance').and.returnValue(instance);
      user.handleMessage('fakeclient', {
        type: social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER,
        data: {},
        version: globals.MESSAGE_VERSION
      });
      expect(instance.handleSignal).toHaveBeenCalled();
    });

  });  // describe communications

  var instanceHandshake :social.InstanceHandshake = {
    instanceId: 'fakeinstance',
    publicKey: <string>null,
    description: 'fake instance',
    consent: {isRequesting: false, isOffering: false}
  }

  describe('client <---> instance', () => {
    it('syncs clientId <--> instanceId mapping', (done) => {
      var realStorage = new local_storage.Storage;
      storage.save = function(key :string, value :Object) {
        return realStorage.save(key, value);
      };
      spyOn(storage, 'save').and.callThrough();
      expect(user.instanceToClient('fakeinstance')).toBeUndefined();
      expect(user.clientToInstance('fakeclient')).toBeUndefined();
      user.syncInstance_('fakeclient', instanceHandshake,
          globals.MESSAGE_VERSION).then(() => {
        expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient');
        expect(user.clientToInstance('fakeclient')).toEqual('fakeinstance');
        instance = user.getInstance('fakeinstance');
        expect(instance).toBeDefined();
        expect(storage.save).toHaveBeenCalled();
        done();
      });
    });

    it('cleanly updates for new clientId <--> instanceId mappings', () => {
      // New client to be associated with the same instance.
      var clientState :social.ClientState = {
        userId: 'fakeuser',
        clientId: 'fakeclient2',
        status: social.ClientStatus.ONLINE,
        timestamp: 12345
      };
      // Add the new client.
      user.handleClient(clientState);
      // Pretend a valid instance message has been sent from the new client.
      user.syncInstance_('fakeclient2', instanceHandshake,
          globals.MESSAGE_VERSION);
      expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient2');
      expect(user.clientToInstance('fakeclient')).toEqual(null);
      expect(user.clientToInstance('fakeclient2')).toEqual('fakeinstance');
    });

    it('syncs UI after updating instance', () => {
      user.syncInstance_('fakeclient', instanceHandshake, globals.MESSAGE_VERSION);
    });

  });  // describe client <---> instance

  describe('local consent towards remote proxy', () => {
    var user = new remote_user.User(network, 'fakeuser2');

    it('can request access, and cancel that request', (done) => {
      user.modifyConsent(uproxy_core_api.ConsentUserAction.REQUEST).then(() => {
        expect(user.consent.localRequestsAccessFromRemote).toEqual(true);
        user.modifyConsent(uproxy_core_api.ConsentUserAction.CANCEL_REQUEST).then(() => {
          expect(user.consent.localRequestsAccessFromRemote).toEqual(false);
          done();
        });
      });
    });

    it('ignores offer from remote', (done) => {
      user.modifyConsent(uproxy_core_api.ConsentUserAction.IGNORE_OFFER).then(() => {
        expect(user.consent.ignoringRemoteUserOffer).toEqual(true);
        done();
      });
    });

    it('un-ignore cancels ignore setting', (done) => {
      user.consent.ignoringRemoteUserOffer = true;
      user.modifyConsent(uproxy_core_api.ConsentUserAction.UNIGNORE_OFFER).then(() => {
        expect(user.consent.ignoringRemoteUserOffer).toEqual(false);
        done();
      });
    });

    it('ignore-offers bit reset after requesting', (done) => {
      user.consent.localRequestsAccessFromRemote = false;
      user.modifyConsent(uproxy_core_api.ConsentUserAction.IGNORE_OFFER).then(() => {
        expect(user.consent.ignoringRemoteUserOffer).toEqual(true);
        user.modifyConsent(uproxy_core_api.ConsentUserAction.REQUEST).then(() => {
          expect(user.consent.localRequestsAccessFromRemote).toEqual(true);
          expect(user.consent.ignoringRemoteUserOffer).toEqual(false);
          done();
        });
      });
    });

    it('invalid proxy transitions do not modify consent', (done) => {
      var emptyConsent = new consent.State(false);

      user.consent = new consent.State(false);
      user.modifyConsent(uproxy_core_api.ConsentUserAction.CANCEL_REQUEST).then(() => {
        expect(user.consent).toEqual(emptyConsent);
        user.modifyConsent(uproxy_core_api.ConsentUserAction.UNIGNORE_OFFER).then(() => {
          expect(user.consent).toEqual(emptyConsent);
          // proxy consent modifications did not touch client consent
          expect(user.consent.localRequestsAccessFromRemote).toEqual(false);
          done();
        });
      });
    });
  });

  describe('local consent towards remote client', () => {
    it('can offer access', (done) => {
      user.modifyConsent(uproxy_core_api.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        done();
      });
    });

    it('can cancel access', (done) => {
      user.consent.localGrantsAccessToRemote = true;
      user.modifyConsent(uproxy_core_api.ConsentUserAction.CANCEL_OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(false);
        done();
      });
    });

    it('allows request from remote', (done) => {
      user.consent.localGrantsAccessToRemote = false;
      user.modifyConsent(uproxy_core_api.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        done();
      });
    });

    it('ignoring request does not change remoteRequestsAccessFromLocal',
        (done) => {
      user.consent.remoteRequestsAccessFromLocal = true;
      user.consent.ignoringRemoteUserRequest = false;
      user.modifyConsent(uproxy_core_api.ConsentUserAction.IGNORE_REQUEST).then(() => {
        expect(user.consent.remoteRequestsAccessFromLocal).toEqual(true);
        expect(user.consent.ignoringRemoteUserRequest).toEqual(true);
        done();
      });
    });

    it('can re-accept even after ignoring', (done) => {
      user.modifyConsent(uproxy_core_api.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        done();
      });
    });

    it('cancelling after granted returns to remote offer', (done) => {
      user.modifyConsent(uproxy_core_api.ConsentUserAction.CANCEL_OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(false);
        expect(user.consent.remoteRequestsAccessFromLocal).toEqual(true);
        done();
      });
    });

    it('ignore-requests bit reset after granting', (done) => {
      user.consent.localGrantsAccessToRemote = false;
      user.consent.ignoringRemoteUserRequest = true;
      user.modifyConsent(uproxy_core_api.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        expect(user.consent.ignoringRemoteUserRequest).toEqual(false);
        done();
      });
    });

    it('invalid client transitions do not modify consent', (done) => {
      var emptyConsent = new consent.State(false);

      user.consent = new consent.State(false);
      user.modifyConsent(uproxy_core_api.ConsentUserAction.CANCEL_OFFER).then(() => {
        expect(user.consent).toEqual(emptyConsent);
        user.modifyConsent(
            uproxy_core_api.ConsentUserAction.UNIGNORE_REQUEST).then(() => {
          expect(user.consent).toEqual(emptyConsent);
          // Client consent modifications did not touch proxy consent
          expect(user.consent.localGrantsAccessToRemote).toEqual(false);
          done();
        });
      });
    });
  });

  it('Initializes with consent for local user', () => {
    user = new remote_user.User(network, network.myInstance.userId);
    expect(user.consent.localRequestsAccessFromRemote).toEqual(true);
    expect(user.consent.localGrantsAccessToRemote).toEqual(true);
    expect(user.consent.remoteRequestsAccessFromLocal).toEqual(true);
  });

  it('Initializes without consent for other users', () => {
    user = new remote_user.User(network, 'otherUser');
    expect(user.consent.localRequestsAccessFromRemote).toEqual(false);
    expect(user.consent.localGrantsAccessToRemote).toEqual(false);
    expect(user.consent.remoteRequestsAccessFromLocal).toEqual(false);
  });

  it('handleInvitePermissions creates new instance if needed', (done) => {
    const USER_ID = '123';
    const INSTANCE_ID = '456';
    const PERMISSION_TOKEN = '999';
    user = new remote_user.User(network, USER_ID);
    var inviteTokenData = {
      v: 1,
      networkName: 'GMail',
      userName: 'Bob',
      networkData: '',
      permission: {
        token: PERMISSION_TOKEN,
        isRequesting: true,
        isOffering: false
      },
      userId: USER_ID,
      instanceId: INSTANCE_ID
    };
    expect(user.getInstance(INSTANCE_ID)).toBeUndefined();
    user.handleInvitePermissions(inviteTokenData);

    // Check that instance is created.
    var instance = user.getInstance(INSTANCE_ID);
    expect(instance).toBeDefined();

    // Check that instance is offline and unusedPermissionToken is set
    expect(user.isInstanceOnline(INSTANCE_ID)).toEqual(false);
    expect(instance.unusedPermissionToken).toEqual(PERMISSION_TOKEN);

    // Wait for instance.update to be complete beore checking consent.
    instance.onceLoaded.then(() => {
      expect(instance.wireConsentFromRemote.isRequesting).toEqual(true);
      expect(instance.wireConsentFromRemote.isOffering).toEqual(false);
      expect(user.consent.remoteRequestsAccessFromLocal).toEqual(true);
      done();
    });
  });

});  // uProxy.User
