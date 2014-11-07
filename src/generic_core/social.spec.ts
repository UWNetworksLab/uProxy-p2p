/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='social.ts' />

class MockSocial {
  public on = () => {}
  public emit = () => {}
  public manifest = () => {}
  public login = () => {}
  public logout = () => {}
  public api = {
    on: () => {},
    sendMessage: () => {}
  }
}

describe('freedomClientToUproxyClient', () => {
  var freedomClient :freedom_Social.ClientState = {
    userId: 'mockmyself',
    clientId: 'fakemyself',
    status: 'ONLINE',
    timestamp: 12345
  };
  var uproxyClient = freedomClientToUproxyClient(freedomClient);

  it('converts status to enum', () => {
    expect(uproxyClient.status).toEqual(UProxyClient.Status.ONLINE);
  });

  it('copies non-status fields unchanged', () => {
    expect(uproxyClient.userId).toEqual(freedomClient.userId);
    expect(uproxyClient.clientId).toEqual(freedomClient.clientId);
    expect(uproxyClient.timestamp).toEqual(freedomClient.timestamp);
  });
});

describe('Social.FreedomNetwork', () => {

  var network :Social.FreedomNetwork;
  // Mock social providers.
  freedom['SOCIAL-badmock'] = () => { return new MockSocial(); };
  freedom['SOCIAL-mock'] = () => { return new MockSocial(); };
  freedom['SOCIAL-mock']['api'] = 'social';

  var loginPromise :Promise<void>;
  var fakeFreedomClient :freedom_Social.ClientState = {
    userId: 'mockmyself',
    clientId: 'fakemyself',
    status: 'ONLINE',
    timestamp: 12345
  };

  beforeEach(() => {
    // Spy / override log messages to keep test output clean.
    //spyOn(console, 'log');
    spyOn(console, 'warn');
    spyOn(console, 'error');
  });

  it('initialize networks', () => {
    Social.initializeNetworks();
    expect(Social.networks['badmock']).not.toBeDefined();
    expect(Social.networks['mock']).toBeDefined();
    expect(Social.networks['mock']).toEqual({});
  });


  it('begins with empty roster', () => {
    network = new Social.FreedomNetwork('mock');
    expect(network.roster).toEqual({});
  });


  describe('login & logout', () => {

    it('can log in', (done) => {
      jasmine.clock().install();
      spyOn(network, 'restoreFromStorage');
      var fulfillFunc;
      var onceLoggedIn = new Promise((F, R) => { fulfillFunc = F; });
      spyOn(network['freedomApi_'], 'login').and.returnValue(onceLoggedIn);
      spyOn(ui, 'showNotification');
      spyOn(network, 'sendInstanceHandshake');
      spyOn(network, 'prepareLocalInstance').and.callFake((userId) => {
        network.myInstance = new Core.LocalInstance(network, userId);
        return Promise.resolve();
      });
      network.login(false).then(() => {
        expect(network.myInstance).toBeDefined();
        expect(network['myInstance'].userId).toEqual(
            fakeFreedomClient.userId);
        var freedomClientState :freedom_Social.ClientState = {
          userId: 'fakeuser',
          clientId: 'fakeclient',
          status: 'ONLINE_WITH_OTHER_APP',
          timestamp: 12345
        };
        // Add user to the roster;
        network.handleClientState(freedomClientState);
        expect(Object.keys(network.roster).length).toEqual(1);
        var friend = network.getUser('fakeuser');
        spyOn(friend, 'monitor');
        expect(friend.isOnline()).toEqual(true);
        // Wait for 5 seconds and make sure monitoring was called.
        jasmine.clock().tick(5000);
        expect(friend.monitor).toHaveBeenCalled();
      }).then(done);
      fulfillFunc(fakeFreedomClient);
      // We need to tick a clock in order promises to be resolved.
      jasmine.clock().tick(1);
    });

    it('errors if network login fails', (done) => {
      loginPromise = network['onceLoggedIn_'];
      network['onceLoggedIn_'] = null;
      // Pretend the social API's login failed.
      spyOn(network['freedomApi_'], 'login').and.returnValue(
          Promise.reject(new Error('mock failure')));
      spyOn(network, 'error');
      network.login(false).catch(() => {
        expect(network['error']).toHaveBeenCalledWith('Could not login.');
      }).then(done);
    });

    it('can log out', (done) => {
      network['onceLoggedIn_'] = loginPromise;
      // Pretend the social API's logout succeeded.
      spyOn(network['freedomApi_'], 'logout').and.returnValue(Promise.resolve());

      var friend = network.getUser('fakeuser');
      spyOn(friend, 'monitor');
      // Monitoring is still running.
      jasmine.clock().tick(5000);
      expect(friend.monitor).toHaveBeenCalled();

      network.logout().then(() => {
        (<any>friend.monitor).calls.reset();
        jasmine.clock().tick(5000);
        expect(friend.monitor).not.toHaveBeenCalled();
        jasmine.clock().uninstall();
        expect(network.myInstance).toEqual(null);
      }).then(done);
    });

  });  // describe login & logout

  describe('handler promise delays', () => {

    // Hijack the social api login promise to delay at the right time.
    var handlerPromise :Promise<void>;
    var fakeLoginFulfill :Function;
    var foo = jasmine.createSpyObj('foo', [
        'bar',
    ]);
    // var delayed :Function;

    it('delays handler until login', () => {
      network = new Social.FreedomNetwork('mock');
      spyOn(network['freedomApi_'], 'login').and.returnValue(
          new Promise((F, R) => {
            fakeLoginFulfill = F;
          }));
      expect(network['onceLoggedIn_']).toBeDefined();
      network.login(false);  // Will complete in the next spec.
      // handlerPromise = delayed('hooray');
      handlerPromise = network['delayForLogin_'](foo.bar)('hooray');
      expect(foo.bar).not.toHaveBeenCalled();
    });

    it('fires handler once logged-in', (done) => {
      fakeLoginFulfill(fakeFreedomClient);
      handlerPromise.then(() => {
        expect(foo['bar']).toHaveBeenCalledWith('hooray');
      }).then(done);
    });

  });  // describe handler promise delays

  describe('incoming events', () => {

    it('adds a new user for |onUserProfile|', () => {
      network = new Social.FreedomNetwork('mock');
      network.myInstance = new Core.LocalInstance(network, 'fakeId');
      expect(Object.keys(network.roster).length).toEqual(0);
      network.handleUserProfile({
        userId: 'mockuser',
        name: 'mock1',
        timestamp: Date.now()
      });
      expect(Object.keys(network.roster).length).toEqual(1);
      var user = network.getUser('mockuser');
      expect(user).toBeDefined;
      expect(user.name).toEqual('mock1');
    });

    it('updates existing user', () => {
      expect(Object.keys(network.roster).length).toEqual(1);
      var user = network.getUser('mockuser');
      spyOn(user, 'update').and.callThrough();
      network.handleUserProfile({
        userId: 'mockuser',
        name: 'newname',
        timestamp: Date.now()
      });
      expect(user.update).toHaveBeenCalled();
      expect(user).toBeDefined;
      expect(user.name).toEqual('newname');
    });

    it('passes |onClientState| to correct client', () => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleClient');
      var freedomClientState :freedom_Social.ClientState = {
        userId: 'mockuser',
        clientId: 'fakeclient',
        status: 'ONLINE',
        timestamp: 12345
      };
      network.handleClientState(freedomClientState);
      expect(user.handleClient).toHaveBeenCalledWith(
        freedomClientToUproxyClient(freedomClientState));
    });

    it('adds placeholder when receiving ClientState with userId not in roster',
        () => {
      var user;
      spyOn(network, 'getUser').and.callFake((userId) => {
        user = network.roster[userId];
        spyOn(user, 'handleClient');
        return user;
      });
      var freedomClientState :freedom_Social.ClientState = {
        userId: 'im_not_here',
        clientId: 'fakeclient',
        status: 'ONLINE',
        timestamp: 12345
      };
      network.handleClientState(freedomClientState);
      expect(user.handleClient).toHaveBeenCalled();
    });

    it('passes |onMessage| to correct client', () => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleMessage');
      var msg = {
        from: {
          userId: 'mockuser',
          clientId: 'fakeclient',
          status: 'ONLINE',
          timestamp: 12345
        },
        message: JSON.stringify({
          'cats': 'meow'
        })
      };
      network.handleMessage(msg);
      expect(user.handleMessage).toHaveBeenCalledWith('fakeclient', {
        'cats': 'meow'
      });
    });

    it('adds placeholder when receiving Message with userId not in roster', () => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleMessage');
      var msg = {
        from: {
          userId: 'im_still_not_here',
          clientId: 'fakeclient',
          status: 'ONLINE',
          timestamp: 12345
        },
        message: null
      };
      network.handleMessage(msg);
      expect(user.handleMessage).not.toHaveBeenCalled();
      expect(network.getUser('im_still_not_here')).toBeDefined();
      expect(console.warn).not.toHaveBeenCalled();
    });

  });  // describe events & communication

  describe('outgoing communications', () => {

    it('calls the social provider sendMessage', () => {
      network['freedomApi_'].sendMessage = jasmine.createSpy('sendMessage');
      var msg = {
        type: uProxy.MessageType.INSTANCE,
        data: {
          'doge': 'wows'
        }
      };
      network.send('someclient', msg);
      expect(network['freedomApi_'].sendMessage).toHaveBeenCalledWith(
        'someclient', '{"type":' + uProxy.MessageType.INSTANCE + ',"data":{"doge":"wows"}}');
    });

    it('sends instance handshake', (done) => {
      spyOn(network['myInstance'], 'getInstanceHandshake').and.returnValue(
        'fake-instance-handshake');
      spyOn(network, 'send').and.returnValue(Promise.resolve());
      network.sendInstanceHandshake('fakeclient', null).then(() => {
        expect(network['myInstance']['getInstanceHandshake']).toHaveBeenCalled();
        expect(network.send).toHaveBeenCalledWith('fakeclient', {
            type: uProxy.MessageType.INSTANCE,
            data: {
              handshake: 'fake-instance-handshake',
              consent: null
            }
        });
      }).then(done);
    });

  });

  it('JSON.parse and stringify messages at the right layer', () => {
    var user = network.getUser('mockuser');
    spyOn(user, 'handleMessage');
    var inMsg = {
      from: {
        userId: 'mockuser',
        clientId: 'fakeclient',
        status: 'ONLINE',
        timestamp: 12345
      },
      message: JSON.stringify({
        'elephants': 'have trunks'
      })
    };
    spyOn(JSON, 'parse').and.callThrough();
    network.handleMessage(inMsg);
    expect(JSON.parse).toHaveBeenCalledWith('{"elephants":"have trunks"}');
    var outMsg = {
      type: uProxy.MessageType.INSTANCE,
      data: {
        'tigers': 'are also cats'
      }
    };
    spyOn(JSON, 'stringify').and.callThrough();
    network.send('fakeclient', outMsg)
    expect(JSON.stringify).toHaveBeenCalledWith(outMsg);
  });

  // TODO: get this unit test to pass.
  /*
  it('Can restore a state that has multiple users', (done) => {
    var networkState :Social.NetworkState = {
      name: 'mock',
      remember: false,
      userIds: ['userA', 'userB', 'userC']
    }
    network.restoreState(networkState).then(() => {
      expect(network.getUser('userA')).toEqual('userA');
      expect(network.getUser('userB')).toEqual('userB');
      expect(network.getUser('userC')).toEqual('userC');
      done();
    });
  });
  */

});


describe('Social.ManualNetwork', () => {

  var network :Social.ManualNetwork =
      new Social.ManualNetwork('Manual');

  var loginPromise :Promise<void>;

  beforeEach(() => {
    // Silence logging to keep test output clean.
    spyOn(console, 'log');
    spyOn(console, 'warn');
    spyOn(console, 'error');
  });

  it('can send messages to the UI', () => {
    spyOn(ui, 'update');

    var message :uProxy.Message = {
      type: uProxy.MessageType.SIGNAL_FROM_CLIENT_PEER,
      data: {
        elephants: 'have trunks',
        birds: 'do not'
      }
    };
    network.send('dummyClientId', message);
    expect(ui.update).toHaveBeenCalledWith(
        uProxy.Update.MANUAL_NETWORK_OUTBOUND_MESSAGE, message);
  });

  it('adds the sender to the roster upon receving a message', () => {
    var senderClientId = 'dummy_client_id';
    var senderUserId = senderClientId;
    spyOn(network, 'getStorePath').and.returnValue('');

    var message :uProxy.Message = {
      type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
      data: {
        elephants: 'have trunks',
        birds: 'do not'
      }
    };

    network.receive(senderClientId, message);
    expect(network.getUser(senderUserId)).toBeDefined();
  });

  it('routes received messages appropriately', () => {
    var senderClientId = 'dummy_client_id';
    var senderUserId = senderClientId;

    var message :uProxy.Message = {
      type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
      data: {
        elephants: 'have trunks',
        birds: 'do not'
      }
    };

    // Send an initial message so ManualNetwork creates the user object that we
    // will spy on.
    network.receive(senderClientId, message);
    var user = network.getUser(senderUserId);
    expect(user).toBeDefined();
    spyOn(user, 'handleMessage');

    network.receive(senderClientId, message);

    expect(user.handleMessage).toHaveBeenCalledWith(senderClientId, message);
  });

});
