/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='user.ts' />
/// <reference path='social.ts' />


describe('Core.User', () => {

  // Prepare a fake Social.Network object to construct User on top of.
  var network = jasmine.createSpyObj('network', [
      'api',
      'sendInstanceHandshake',
      'getLocalInstanceId'
  ]);
  network['send'] = () => {};

  // var profile :freedom.Social.UserProfile = {
    // name: 'Alice',
    // userId: 'fakeuser',
    // timestamp: 456
  // };
  var user :Core.User;
  var instance :Core.RemoteInstance;

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
    spyOn(ui, 'syncInstance');
  });

  it('creates with the correct userId', () => {
    user = new Core.User(network, 'fakeuser');
    expect(user.userId).toEqual('fakeuser');
    expect(user['network']).toEqual(network);
  });

  it('creates with pending name if there was no profile', () => {
    expect(user.name).toEqual('pending');
  });

  it('created with an empty client and instance tables', () => {
    expect(user.clients).toEqual({});
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
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(network.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient');
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(user.clients['fakeclient']).toEqual(freedom.Social.Status.ONLINE);
    expect(Object.keys(user.clients)).toEqual([
      'fakeclient'
    ]);
  });

  it('does not re-send instance messages to the same client', () => {
    network.sendInstanceHandshake.calls.reset();
    expect(user.clients['fakeclient']).toEqual(freedom.Social.Status.ONLINE);
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(Object.keys(user.clients)).toEqual([
      'fakeclient'
    ]);
    expect(network.sendInstanceHandshake).not.toHaveBeenCalled();
  });

  it('does not send instance messages to non-uProxy clients', () => {
    network.sendInstanceHandshake.calls.reset();
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient-not-uproxy',
      status: freedom.Social.Status.ONLINE_WITH_OTHER_APP,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(Object.keys(user.clients)).toEqual([
      'fakeclient',
    ]);
    expect(network.sendInstanceHandshake).not.toHaveBeenCalled();
  });

  it('deletes DISCONNECTED client', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.OFFLINE,
      timestamp: 12346
    };
    user.handleClient(clientState);
    expect(Object.keys(user.clients).length).toEqual(0);
    expect(user.clients['fakeclient']).not.toBeDefined();
  });

  it('re-adds an re-sends instance message to new ONLINE clients', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    expect(network.sendInstanceHandshake).toHaveBeenCalledWith('fakeclient');
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(user.clients['fakeclient']).toEqual(freedom.Social.Status.ONLINE);
    expect(Object.keys(user.clients)).toEqual([
      'fakeclient'
    ]);
  });

  it('logs an error when receiving a ClientState with wrong userId', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuserd',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
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
      expect(user['syncInstance_']).toHaveBeenCalled();
    });

    it('handles a CONSENT message', () => {
      spyOn(user, 'handleConsent_');
      user.handleMessage('fakeclient', {
        type: uProxy.MessageType.CONSENT,
        data: {
          'bar': 2
        }
      });
      expect(user['handleConsent_']).toHaveBeenCalled();
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
        type: uProxy.MessageType.CONSENT,
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

  describe('client <---> instance', () => {

    beforeEach(() => {
      if (instance) {
        spyOn(instance, 'update');
        spyOn(instance, 'send');
      }
      // Don't test reconnection promises in this sub-suite.
      spyOn(user, 'fulfillReconnection_');
    });

    it('syncs clientId <--> instanceId mapping', () => {
      expect(user.instanceToClient('fakeinstance')).toBeUndefined();
      expect(user.clientToInstance('fakeclient')).toBeUndefined();
      user['syncInstance_']('fakeclient', instanceData);
      expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient');
      expect(user.clientToInstance('fakeclient')).toEqual('fakeinstance');
      instance = user.getInstance('fakeinstance');
      expect(instance).toBeDefined();
    });

    it('cleanly updates for new clientId <--> instanceId mappings', () => {
      // New client to be associated with the same instance.
      var clientState :freedom.Social.ClientState = {
        userId: 'fakeuser',
        clientId: 'fakeclient2',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      };
      // Add the new client.
      user.handleClient(clientState);
      // Pretend a valid instance message has been sent from the new client.
      user['syncInstance_']('fakeclient2', instanceData);
      expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient2');
      expect(user.clientToInstance('fakeclient')).toEqual(null);
      expect(user.clientToInstance('fakeclient2')).toEqual('fakeinstance');
    });

    it('sends consent message if Instance already exists', () => {
      expect(instance).toBeDefined();
      spyOn(instance, 'sendConsent');
      user['syncInstance_']('fakeclient', instanceData);
      expect(instance.sendConsent).toHaveBeenCalled();
    });

    it('syncs UI after updating instance', () => {
      user['syncInstance_']('fakeclient', instanceData);
      expect(ui.syncInstance).toHaveBeenCalled();
    });

  });  // describe client <---> instance

  describe('instance sending promises', () => {

    var msg :uProxy.Message = {
      type: uProxy.MessageType.INSTANCE,
      data: 'foo'
    };
    var reconnect = null;
    var reconnected = false;

    beforeEach(() => {
      // Pretend that Social.Network.send always returns a successful promise.
      spyOn(network, 'send').and.returnValue(Promise.resolve());
      if (instance) {
        spyOn(instance, 'update');
        spyOn(instance, 'send');
      }
    })

    it('sending message to online instanceId fulfills promise with clientId',
        (done) => {
      instance = user.getInstance('fakeinstance');
      user.send('fakeinstance', msg).then((clientId) => {
        expect(clientId).toEqual('fakeclient');
      }).then(done);
    });

    it('sending message to invalid instanceId throws error', (done) => {
      instance = user.getInstance('fakeinstance');
      user.send('nobody', msg).catch((e) => {
        expect(e.message).toEqual('Cannot send to invalid instance nobody');
      }).then(done);
    });

    var reconnectPromise;

    it('sending message to offline instanceId prepares reconnection promise',
        () => {
      user['removeClient_']('fakeclient');
      user['removeClient_']('fakeclient2');
      expect(Object.keys(user.clients).length).toEqual(0);
      expect(user.clients['fakeclient']).not.toBeDefined();
      reconnectPromise = user.send('fakeinstance', msg).then((clientId) => {
        expect(clientId).toEqual('newclient');
        reconnected = true;
      });
      reconnect = user['reconnections_']['fakeinstance'];
      expect(reconnect.promise).toBeDefined();
      expect(reconnect.fulfill).toBeDefined();
    });

    it('delivers pending messages & fulfills with new client ID on reconnect',
        (done) => {
      spyOn(user, 'fulfillReconnection_').and.callThrough();
      spyOn(user, 'syncInstance_').and.callThrough();
      // Simulate a full reconnection to a new client.
      var clientState = {
        userId: 'fakeuser',
        clientId: 'newclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      };
      user.handleClient(clientState);
      user.handleMessage('newclient', {
        type: uProxy.MessageType.INSTANCE,
        data: instanceData
      });
      expect(user['fulfillReconnection_']).toHaveBeenCalled();
      expect(reconnectPromise).toBeDefined();
      reconnectPromise.then(() => {
        expect(reconnected).toEqual(true);
        expect(network.send).toHaveBeenCalledWith('newclient', {
          type: uProxy.MessageType.INSTANCE,
          data: 'foo'
        });
      }).then(done);
    });

    it('round-trip future delivery of multiple pending messages', (done) => {
      var n = 10;
      var messages = [];
      var promises = [];
      // Disconnect the client.
      user.handleClient({
        userId: 'fakeuser',
        clientId: 'newclient',
        status: freedom.Social.Status.OFFLINE,
        timestamp: 12345
      });
      expect(user.clients['newclient']).not.toBeDefined();
      for (var i = 0 ; i < n ; ++i) {
        promises.push(user.send('fakeinstance', <uProxy.Message>{
          type: uProxy.MessageType.INSTANCE,
          data: i
        }));
      }
      expect(Object.keys(user['reconnections_']).length).toEqual(1);
      var newClientState = {
        userId: 'fakeuser',
        clientId: 'even-newer-client',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      };
      user.handleClient(newClientState);
      user.handleMessage('even-newer-client', {
        type: uProxy.MessageType.INSTANCE,
        data: instanceData
      });
      // Expect all reconnections and messages to fire and become empty.
      Promise.all(promises).then((vals) => {
        expect(network.send.calls.count()).toEqual(n);
        var sum = 0;
        for (var i = 0 ; i < n ; ++i) {
          // Ensure each message sent correctly.
          var args = network.send.calls.argsFor(i);
          expect(args[0]).toEqual('even-newer-client');
          sum += parseInt(args[1].data);
        }
        expect(sum).toEqual(n * (n - 1) / 2);
        expect(user['reconnections_']).toEqual({});
      }).then(done);
    });

  });  // describe instance sending promises

});  // uProxy.User
