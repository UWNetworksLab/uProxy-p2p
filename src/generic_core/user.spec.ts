/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='user.ts' />
/// <reference path='social.ts' />


describe('Core.User', () => {
  // Prepare a fake Social.Network object to construct User on top of.
  var network = jasmine.createSpyObj('network', [
      'api',
      'getStorePath',
      'notifyUI'
  ]);
  network['getLocalInstanceId'] = function() { return 'dummyInstanceId'; };
  network['send'] = () => { return Promise.resolve(); };

  var user :Core.User;
  var instance :Core.RemoteInstance;

  it('creates with the correct userId', (done) => {
    user = new Core.User(network, 'fakeuser');
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
    var clientState :UProxyClient.State = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: UProxyClient.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(user.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient');
    expect(user.clientIdToStatusMap['fakeclient']).toEqual(UProxyClient.Status.ONLINE);
  });

  it('does not re-send instance messages to the same client', () => {
    spyOn(user, 'sendInstanceHandshake');
    expect(user.clientIdToStatusMap['fakeclient']).toEqual(UProxyClient.Status.ONLINE);
    var clientState :UProxyClient.State = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: UProxyClient.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(user.sendInstanceHandshake).not.toHaveBeenCalled();
  });

  it('does not add clients that are ONLINE_WITH_OTHER_APP', () => {
    var clientState :UProxyClient.State = {
      userId: 'fakeuser',
      clientId: 'fakeNonUproxyClient',
      status: UProxyClient.Status.ONLINE_WITH_OTHER_APP,
      timestamp: 12346
    };
    user.handleClient(clientState);
    expect(user.clientIdToStatusMap['fakeNonUproxyClient']).not.toBeDefined();
  });

  it('deletes DISCONNECTED client', () => {
    var clientState :UProxyClient.State = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: UProxyClient.Status.OFFLINE,
      timestamp: 12346
    };
    user.handleClient(clientState);
    expect(user.clientIdToStatusMap['fakeclient']).not.toBeDefined();
  });

  it('re-adds an re-sends instance message to new ONLINE clients', () => {
    spyOn(user, 'sendInstanceHandshake');
    var clientState :UProxyClient.State = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: UProxyClient.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(user.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient');
    expect(user.clientIdToStatusMap['fakeclient']).toEqual(UProxyClient.Status.ONLINE);
  });

  it('logs an error when receiving a ClientState with wrong userId', () => {
    var clientState :UProxyClient.State = {
      userId: 'fakeuserd',
      clientId: 'fakeclient',
      status: UProxyClient.Status.ONLINE,
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
        type: uProxy.MessageType.INSTANCE,
        data: {
          instanceId: 'instanceId', description: '', keyHash: '',
          consent: {isOffering: false, isRequesting: false}
        }
      });
      expect(user.syncInstance_).toHaveBeenCalled();
    });

    it('handles a SIGNAL* messages', () => {
      var instance = jasmine.createSpyObj('instance', ['handleSignal']);
      spyOn(user, 'clientToInstance');
      spyOn(user, 'getInstance').and.returnValue(instance);
      user.handleMessage('fakeclient', {
        type: uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER,
        data: {}
      });
      expect(instance.handleSignal).toHaveBeenCalled();
    });

  });  // describe communications

  var instanceData = {
    instanceId: 'fakeinstance',
    keyHash: null,
    status: null,
    consent: {isRequesting: false, isOffering: false}
  };

  var instanceHandshake = {
    instanceId: instanceData.instanceId,
    keyHash: instanceData.keyHash,
    description: 'fake instance',
    consent: {isRequesting: false, isOffering: false}
  }

  describe('client <---> instance', () => {
    it('syncs clientId <--> instanceId mapping', (done) => {
      var realStorage = new Core.Storage;
      var saved;
      storage.save = function(key, value) {
        saved = realStorage.save(key, value);
        return saved;
      };
      expect(user.instanceToClient('fakeinstance')).toBeUndefined();
      expect(user.clientToInstance('fakeclient')).toBeUndefined();
      user.syncInstance_('fakeclient', instanceHandshake).then(() => {
        expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient');
        expect(user.clientToInstance('fakeclient')).toEqual('fakeinstance');
        instance = user.getInstance('fakeinstance');
        expect(instance).toBeDefined();
        expect(saved).toBeDefined();
        done();
      });
    });

    it('cleanly updates for new clientId <--> instanceId mappings', () => {
      // New client to be associated with the same instance.
      var clientState :UProxyClient.State = {
        userId: 'fakeuser',
        clientId: 'fakeclient2',
        status: UProxyClient.Status.ONLINE,
        timestamp: 12345
      };
      // Add the new client.
      user.handleClient(clientState);
      // Pretend a valid instance message has been sent from the new client.
      user.syncInstance_('fakeclient2', instanceHandshake);
      expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient2');
      expect(user.clientToInstance('fakeclient')).toEqual(null);
      expect(user.clientToInstance('fakeclient2')).toEqual('fakeinstance');
    });

    it('syncs UI after updating instance', () => {
      user.syncInstance_('fakeclient', instanceHandshake);
    });

  });  // describe client <---> instance

  describe('local consent towards remote proxy', () => {
    var user = new Core.User(network, 'fakeuser2');

    it('can request access, and cancel that request', (done) => {
      user.modifyConsent(uProxy.ConsentUserAction.REQUEST).then(() => {
        expect(user.consent.localRequestsAccessFromRemote).toEqual(true);
        user.modifyConsent(uProxy.ConsentUserAction.CANCEL_REQUEST).then(() => {
          expect(user.consent.localRequestsAccessFromRemote).toEqual(false);
          done();
        });
      });
    });

    it('ignores offer from remote', (done) => {
      user.modifyConsent(uProxy.ConsentUserAction.IGNORE_OFFER).then(() => {
        expect(user.consent.ignoringRemoteUserOffer).toEqual(true);
        done();
      });
    });

    it('un-ignore cancels ignore setting', (done) => {
      user.consent.ignoringRemoteUserOffer = true;
      user.modifyConsent(uProxy.ConsentUserAction.UNIGNORE_OFFER).then(() => {
        expect(user.consent.ignoringRemoteUserOffer).toEqual(false);
        done();
      });
    });

    it('ignore-offers bit reset after requesting', (done) => {
      user.consent.localRequestsAccessFromRemote = false;
      user.modifyConsent(uProxy.ConsentUserAction.IGNORE_OFFER).then(() => {
        expect(user.consent.ignoringRemoteUserOffer).toEqual(true);
        user.modifyConsent(uProxy.ConsentUserAction.REQUEST).then(() => {
          expect(user.consent.localRequestsAccessFromRemote).toEqual(true);
          expect(user.consent.ignoringRemoteUserOffer).toEqual(false);
          done();
        });
      });
    });

    it('invalid proxy transitions do not modify consent', (done) => {
      var emptyConsent = new Consent.State();

      user.consent = new Consent.State();
      user.modifyConsent(uProxy.ConsentUserAction.CANCEL_REQUEST).then(() => {
        expect(user.consent).toEqual(emptyConsent);
        user.modifyConsent(uProxy.ConsentUserAction.UNIGNORE_OFFER).then(() => {
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
      user.modifyConsent(uProxy.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        done();
      });
    });

    it('can cancel access', (done) => {
      user.consent.localGrantsAccessToRemote = true;
      user.modifyConsent(uProxy.ConsentUserAction.CANCEL_OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(false);
        done();
      });
    });

    it('allows request from remote', (done) => {
      user.consent.localGrantsAccessToRemote = false;
      user.modifyConsent(uProxy.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        done();
      });
    });

    it('ignoring request does not change remoteRequestsAccessFromLocal',
        (done) => {
      user.consent.remoteRequestsAccessFromLocal = true;
      user.consent.ignoringRemoteUserRequest = false;
      user.modifyConsent(uProxy.ConsentUserAction.IGNORE_REQUEST).then(() => {
        expect(user.consent.remoteRequestsAccessFromLocal).toEqual(true);
        expect(user.consent.ignoringRemoteUserRequest).toEqual(true);
        done();
      });
    });

    it('can re-accept even after ignoring', (done) => {
      user.modifyConsent(uProxy.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        done();
      });
    });

    it('cancelling after granted returns to remote offer', (done) => {
      user.modifyConsent(uProxy.ConsentUserAction.CANCEL_OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(false);
        expect(user.consent.remoteRequestsAccessFromLocal).toEqual(true);
        done();
      });
    });

    it('ignore-requests bit reset after granting', (done) => {
      user.consent.localGrantsAccessToRemote = false;
      user.consent.ignoringRemoteUserRequest = true;
      user.modifyConsent(uProxy.ConsentUserAction.OFFER).then(() => {
        expect(user.consent.localGrantsAccessToRemote).toEqual(true);
        expect(user.consent.ignoringRemoteUserRequest).toEqual(false);
        done();
      });
    });

    it('invalid client transitions do not modify consent', (done) => {
      var emptyConsent = new Consent.State();

      user.consent = new Consent.State();
      user.modifyConsent(uProxy.ConsentUserAction.CANCEL_OFFER).then(() => {
        expect(user.consent).toEqual(emptyConsent);
        user.modifyConsent(
            uProxy.ConsentUserAction.UNIGNORE_REQUEST).then(() => {
          expect(user.consent).toEqual(emptyConsent);
          // Client consent modifications did not touch proxy consent
          expect(user.consent.localGrantsAccessToRemote).toEqual(false);
          done();
        });
      });
    });
  });

});  // uProxy.User
