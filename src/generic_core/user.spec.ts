/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='user.ts' />
/// <reference path='social.ts' />


// class MockNetwork implements Social.Network {
  // roster
  // api = {
    // on: null,
    // once: null,
    // login: null,
    // logout: null,
    // clearCachedCredentials: null,
    // getUsers: null,
    // getClients: null,
    // sendMessage: (clientId, msg) => {
      // return Promise.resolve();
    // }
  // };
// 
// }  // class MockNetwork


describe('Core.User', () => {

  // var network = new MockNetwork();
  // var network = new Social.Network('mock');
  var network = jasmine.createSpyObj('network', ['api']);
  // network.api['sendMessage'] = jasmine.createSpy();

  var profile :freedom.Social.UserProfile = {
    name: 'Alice',
    userId: 'fakeuser',
    timestamp: 456
  };
  var user :Core.User;

  it('creates with the correct userId', () => {
    user = new Core.User(network, profile);
    expect(user.userId).toEqual('fakeuser');
    expect(user.name).toEqual('Alice');
  });

  it('created with an empty clientId list', () => {
    expect(user['clientToInstanceMap_']).toEqual({});
  });

  it('sends an instance message to newly ONLINE clients', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    spyOn(user, 'send');
    user.handleClient(clientState);
    expect(user.send).toHaveBeenCalled();
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(user.clients['fakeclient']).toEqual(freedom.Social.Status.ONLINE);
    expect(Object.keys(user.clients)).toEqual([
      'fakeclient'
    ]);
  });

  it('does not re-send instance messages to the same client', () => {
    expect(user.clients['fakeclient']).toEqual(freedom.Social.Status.ONLINE);
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    spyOn(user, 'send');
    user.handleClient(clientState);
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(Object.keys(user.clients)).toEqual([
      'fakeclient'
    ]);
    expect(user.send).not.toHaveBeenCalled();
  });

  it('handles DISCONNECTED client', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.OFFLINE,
      timestamp: 12346
    };
    user.handleClient(clientState);
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(user.clients['fakeclient']).toEqual(freedom.Social.Status.OFFLINE);
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

  function makeAliceMessage(msg :uProxy.Message) :freedom.Social.IncomingMessage {
    return {
      from: {
        userId: 'fakeuser',
        clientId: 'fakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12346
      },
      message: JSON.stringify(msg)
    };
  }

  it('handles an INSTANCE message', () => {
    spyOn(user, 'syncInstance_');
    user.handleMessage(makeAliceMessage({
      type: uProxy.MessageType.INSTANCE,
      data: {
        'foo': 1
      }
    }));
    expect(user['syncInstance_']).toHaveBeenCalled();
  });

  it('handles a CONSENT message', () => {
    spyOn(user, 'handleConsent_');
    user.handleMessage(makeAliceMessage({
      type: uProxy.MessageType.CONSENT,
      data: {
        'bar': 2
      }
    }));
    expect(user['handleConsent_']).toHaveBeenCalled();
  });

  it('errors when receiving a message with invalid MessageType', () => {
    spyOn(console, 'error');
    user.handleMessage(makeAliceMessage({
      type: <uProxy.MessageType>0,
      data: {
        'baz': 3
      }
    }));
    expect(console.error).toHaveBeenCalled();
  });

  it('errors when receiving a message with wrong userId', () => {
    var msg :freedom.Social.IncomingMessage = {
      from: {
        userId: 'REALLYfakeuser',
        clientId: 'fakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12346
      },
      message: 'hello'
    };
    spyOn(console, 'error');
    user.handleMessage(msg);
    expect(console.error).toHaveBeenCalled();
  });

  it('errors when receiving a message with non-existing client', () => {
    var msg :freedom.Social.IncomingMessage = {
      from: {
        userId: 'fakeuser',
        clientId: 'REALLYfakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12346
      },
      message: 'hello'
    };
    spyOn(console, 'error');
    user.handleMessage(msg);
    expect(console.error).toHaveBeenCalled();
  });

  it('syncs clientId <--> instanceId mapping', () => {
    expect(user.instanceToClient('fakeinstance')).toBeUndefined();
    expect(user.clientToInstance('fakeclient')).toBeUndefined();
    var instance :Instance = {
      instanceId: 'fakeinstance',
      keyHash: null,
      trust: null,
      status: null,
      description: 'fake instance',
      notify: null
    };
    user['syncInstance_']('fakeclient', instance);
    expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient');
    expect(user.clientToInstance('fakeclient')).toEqual('fakeinstance');
  });

  it('cleanly updates for new clientId <--> instanceId mappings', () => {
    var instance :Instance = {
      instanceId: 'fakeinstance',
      keyHash: null,
      trust: null,
      status: null,
      description: 'fake instance',
      notify: null
    };
    // New client.
    var clientState :freedom.Social.ClientState = {
      userId: 'fakeuser',
      clientId: 'fakeclient2',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClient(clientState);
    user['syncInstance_']('fakeclient2', instance);
    expect(user.instanceToClient('fakeinstance')).toEqual('fakeclient2');
    expect(user.clientToInstance('fakeclient')).toEqual(null);
    expect(user.clientToInstance('fakeclient2')).toEqual('fakeinstance');
  });

});  // uProxy.User
