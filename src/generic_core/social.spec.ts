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
describe('Social.Network', () => {

  var network :Social.Network;
  // Mock social providers.
  freedom['SOCIAL-badmock'] = () => { return new MockSocial(); };
  freedom['SOCIAL-mock'] = () => { return new MockSocial(); };
  freedom['SOCIAL-mock']['api'] = 'social';

  beforeEach(() => {
    // Spy / override log messages to keep test output clean.
    spyOn(console, 'log');
    spyOn(console, 'warn');
    spyOn(console, 'error');
  });

  it('fails to initialize if api is not social', () => {
    Social.initializeNetworks(['badmock']);
    expect(console.warn).toHaveBeenCalled();
  });

  it('successfully initializes if api is social', () => {
    Social.initializeNetworks(['mock']);
    network = Social.getNetwork('mock');
    expect(network.name).toEqual('mock');
  });

  it('begins with empty roster', () => {
    expect(network.roster).toEqual({});
  });

  it('initializes with a LocalInstance', () => {
    expect(network['myInstance']).toBeDefined();
    expect(network['getInstanceHandshake_']()).toBeDefined();
  });

  describe('login & logout', () => {

    it('can login', (done) => {
      var fakeSuccessClient :freedom.Social.ClientState = {
        userId: 'mockmyself',
        clientId: 'fakemyself',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      }
      spyOn(network['api'], 'login').and.returnValue(
          Promise.resolve(fakeSuccessClient));
      spyOn(network, 'notifyUI');
      network.login().then(() => {
        expect(network['myClient']).toEqual(fakeSuccessClient);
        expect(network['online']).toEqual(true);
        expect(network.notifyUI).toHaveBeenCalled();
      }).then(done);
    });

    it('warns if network login fails', (done) => {
      network['online'] = false;
      // Pretend the social API's login failed.
      spyOn(network['api'], 'login').and.returnValue(
          Promise.reject(new Error('mock failure')));
      spyOn(network, 'notifyUI');
      network.login().then(() => {
        expect(console.warn).toHaveBeenCalledWith('Could not login to mock');
        expect(network.notifyUI).not.toHaveBeenCalled();
      }).then(done);
    });

    it('does nothing to login if already logged in', (done) => {
      network['online'] = true;
      spyOn(network, 'notifyUI');
      network.login().then(() => {
        expect(network['online']).toEqual(true);
        expect(network.notifyUI).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('Already logged in to mock');
      }).then(done);
    });

    it('can logout', (done) => {
      network['online'] = true;
      // Pretend the social API's logout succeeded.
      spyOn(network['api'], 'logout').and.returnValue(Promise.resolve());
      spyOn(network, 'notifyUI');
      network.logout().then(() => {
        expect(network['myClient']).toEqual(null);
        expect(network['online']).toEqual(false);
        expect(network.notifyUI).toHaveBeenCalled();
      }).then(done);
    });

    it('does nothing to logout if already logged out', () => {
      network['online'] = false;
      spyOn(network, 'notifyUI');
      network.logout().then(() => {
        expect(network['myClient']).toEqual(null);
        expect(network['online']).toEqual(false);
        expect(network.notifyUI).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith('Already loggout out of mock');
      });
    });

  });  // describe login & logout

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
      var clientState :freedom.Social.ClientState = {
        userId: 'mockuser',
        clientId: 'fakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      };
      network.handleClientState(clientState);
      expect(user.handleClient).toHaveBeenCalledWith(clientState);
    });

    it('adds placeholder when receiving ClientState with userId not in roster',
        () => {
      var user;
      spyOn(network, 'getUser').and.callFake((userId) => {
        user = network.roster[userId];
        spyOn(user, 'handleClient');
        return user;
      });
      var clientState :freedom.Social.ClientState = {
        userId: 'im_not_here',
        clientId: 'fakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      };
      network.handleClientState(clientState);
      expect(user.handleClient).toHaveBeenCalled();
    });

    it('passes |onMessage| to correct client', () => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleMessage');
      var msg = {
        from: {
          userId: 'mockuser',
          clientId: 'fakeclient',
          status: freedom.Social.Status.ONLINE,
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
          status: freedom.Social.Status.ONLINE,
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
      network['api'].sendMessage = jasmine.createSpy('sendMessage');
      var msg = {
        type: uProxy.MessageType.CONSENT,
        data: {
          'doge': 'wows'
        }
      };
      network.send('someclient', msg);
      expect(network['api'].sendMessage).toHaveBeenCalledWith(
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
        status: freedom.Social.Status.ONLINE,
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

});
