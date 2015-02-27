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
  network['getLocalInstance'] = function() {
    return { instanceId: 'dummyInstanceId' };
  };
  network['send'] = () => {};

  var user :Core.User;
  var instance :Core.RemoteInstance;

  beforeEach(() => {
    spyOn(console, 'log');
  });

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
    expect(user.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient', null);
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
    expect(user.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient', null);
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
    expect(console.error).toHaveBeenCalled();
  });

  describe('handlers', () => {

    it('handles an INSTANCE message', () => {
      spyOn(user, 'syncInstance_');
      user.handleMessage('fakeclient', {
        type: uProxy.MessageType.INSTANCE,
        data: {
          'foo': 1
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

    it('errors when receiving a message with invalid MessageType', () => {
      spyOn(console, 'error');
      user.handleMessage('fakeclient', {
        type: <uProxy.MessageType>0,
        data: {
          'baz': 3
        }
      });
      expect(console.error).toHaveBeenCalled();
    });

    // TODO: Determine if we care about non-existing clients, or if we should
    // queue and wait for the client to exist.
    it('errors when receiving a message with non-existing client', () => {
      spyOn(console, 'error');
      user.handleMessage('REALLYfakeclient', {
        type: uProxy.MessageType.INSTANCE,
        data: 'meow'
      });
      expect(console.error).toHaveBeenCalled();
    });

  });  // describe communications

  var instanceData :Instance = {
    instanceId: 'fakeinstance',
    keyHash: null,
    status: null,
    description: 'fake instance',
  };

  var instanceHandshake = {
    handshake :instanceData,
    consent :null
  }

  describe('client <---> instance', () => {

    beforeEach(() => {
      if (instance) {
        spyOn(instance, 'update');
      }
      // Don't test reconnection promises in this sub-suite.
    });

    it('syncs clientId <--> instanceId mapping', (done) => {
      var realStorage = new Core.Storage;
      var saved;
      storage.save = function(key, value) {
        saved = realStorage.save(key, value);
        return saved;
      };
        expect(user.instanceToClient('fakeinstance')).toBeUndefined();
        expect(user.clientToInstance('fakeclient')).toBeUndefined();
        user.syncInstance_('fakeclient', instanceHandshake);
        expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient');
        expect(user.clientToInstance('fakeclient')).toEqual('fakeinstance');
        instance = user.getInstance('fakeinstance');
        expect(instance).toBeDefined();
        user.onceLoaded.then(() => {
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

    it('sends consent message if Instance already exists', () => {
      instanceHandshake.consent = null;
      expect(instance).toBeDefined();
      spyOn(instance, 'sendConsent');
      user.syncInstance_('fakeclient', instanceHandshake);
      expect(instance.sendConsent).toHaveBeenCalled();
    });

    it('syncs UI after updating instance', () => {
      user.syncInstance_('fakeclient', instanceHandshake);
    });

  });  // describe client <---> instance

  it('sends instance handshake', (done) => {
    var network = user.network;
    network['myInstance'] = {getInstanceHandshake: function() {}};
    spyOn(network['myInstance'], 'getInstanceHandshake').and.returnValue(
      'fake-instance-handshake');
    spyOn(network, 'send').and.returnValue(Promise.resolve());
    user.sendInstanceHandshake('fakeclient', null).then(() => {
      expect(network['myInstance']['getInstanceHandshake']).toHaveBeenCalled();
      expect(network.send).toHaveBeenCalledWith(user, 'fakeclient', {
          type: uProxy.MessageType.INSTANCE,
          data: {
            handshake: 'fake-instance-handshake',
            consent: null
          }
      });
    }).then(done);
  });

});  // uProxy.User
