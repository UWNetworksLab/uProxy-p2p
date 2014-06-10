/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
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
  var freedomClient :freedom.Social.ClientState = {
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
  var fakeFreedomClient :freedom.Social.ClientState = {
    userId: 'mockmyself',
    clientId: 'fakemyself',
    status: 'ONLINE',
    timestamp: 12345
  };

  beforeEach(() => {
    // Spy / override log messages to keep test output clean.
    spyOn(console, 'log');
    spyOn(console, 'warn');
    spyOn(console, 'error');
  });

  it('fails to initialize if api is not social', () => {
    Social.initializeNetworks();
    expect(Social.networks['badmock']).not.toBeDefined();
  });

  var loadedLocalInstance = false;

  it('successfully initializes if api is social', () => {
    spyOn(storage, 'load').and.callFake(() => {
      loadedLocalInstance = true;
      return Promise.resolve({});
    });
    Social.initializeNetworks();
    network = <Social.FreedomNetwork> Social.getNetwork('mock');
    expect(network.name).toEqual('mock');
  });

  it('begins with empty roster', () => {
    expect(network.roster).toEqual({});
  });

  it('initializes with a LocalInstance', () => {
    expect(loadedLocalInstance).toEqual(true);
  });

  describe('login & logout', () => {

    it('can log in', (done) => {
      var fulfillFunc;
      var onceLoggedIn = new Promise((F, R) => { fulfillFunc = F; });
      spyOn(network['freedomApi_'], 'login').and.returnValue(onceLoggedIn);
      spyOn(network, 'notifyUI');
      expect(network.isLoginPending()).toEqual(false);
      network.login(false).then(() => {
        expect(network['myInstance'].userId).toEqual(
            fakeFreedomClient.userId);
        expect(network.isOnline()).toEqual(true);
        expect(network.isLoginPending()).toEqual(false);
        expect(network.notifyUI).toHaveBeenCalled();
      }).then(done);
      expect(network.isLoginPending()).toEqual(true);
      fulfillFunc(fakeFreedomClient);
    });

    it('does nothing to log in if already logged in', (done) => {
      spyOn(network, 'notifyUI');
      expect(network.isLoginPending()).toEqual(false);
      network.login(false).then(() => {
        expect(network.isLoginPending()).toEqual(false);
        expect(network.isOnline()).toEqual(true);
        expect(network.notifyUI).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('Already logged in to mock');
      }).then(done);
      // isPendingLogin should be false right away, without waiting for async
      // login to complete.
      expect(network.isLoginPending()).toEqual(false);
    });

    it('errors if network login fails', (done) => {
      loginPromise = network['onceLoggedIn_'];
      network['onceLoggedIn_'] = null;
      // Pretend the social API's login failed.
      spyOn(network['freedomApi_'], 'login').and.returnValue(
          Promise.reject(new Error('mock failure')));
      spyOn(network, 'notifyUI');
      spyOn(network, 'error');
      network.login(false).catch(() => {
        expect(network['error']).toHaveBeenCalledWith('Could not login.');
        expect(network.notifyUI).not.toHaveBeenCalled();
      }).then(done);
    });

    it('can log out', (done) => {
      network['onceLoggedIn_'] = loginPromise;
      // Pretend the social API's logout succeeded.
      spyOn(network['freedomApi_'], 'logout').and.returnValue(Promise.resolve());
      spyOn(network, 'notifyUI');
      network.logout().then(() => {
        expect(network.isOnline()).toEqual(false);
        expect(network.isLoginPending()).toEqual(false);
        expect(network.notifyUI).toHaveBeenCalled();
      }).then(done);
    });

    it('does nothing to logout if already logged out', (done) => {
      network['onceLoggedIn_'] = null;
      spyOn(network, 'notifyUI');
      network.logout().then(() => {
        expect(network.isOnline()).toEqual(false);
        expect(network.notifyUI).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('Already logged out of mock');
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
      expect(network.isOnline()).toEqual(false);
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
      var freedomClientState :freedom.Social.ClientState = {
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
      var freedomClientState :freedom.Social.ClientState = {
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
        type: uProxy.MessageType.CONSENT,
        data: {
          'doge': 'wows'
        }
      };
      network.send('someclient', msg);
      expect(network['freedomApi_'].sendMessage).toHaveBeenCalledWith(
        'someclient', '{"type":3001,"data":{"doge":"wows"}}');
    });

    it('sends instance handshake', (done) => {
      spyOn(network['myInstance'], 'getInstanceHandshake').and.returnValue(
        'fake-instance-handshake');
      spyOn(network, 'send').and.returnValue(Promise.resolve());
      network.sendInstanceHandshake('fakeclient').then(() => {
        expect(network['myInstance']['getInstanceHandshake']).toHaveBeenCalled();
        expect(network.send).toHaveBeenCalledWith('fakeclient', {
            type: uProxy.MessageType.INSTANCE,
            data: 'fake-instance-handshake'
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
      type: uProxy.MessageType.CONSENT,
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
