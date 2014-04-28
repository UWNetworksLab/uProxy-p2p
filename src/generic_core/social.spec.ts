/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='social.ts' />

class MockSocial {
  public on = () => {}
  public emit = () => {}
  public manifest = () => {}
  public login = () => {}
  public logout = () => {}
  public api = {
    on: () => {}
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
    // TODO: Expect a local instance handshake message to be prepared too.
  });

  describe('login & logout', () => {

    it('can login', (done) => {
      var fakeSuccessClient :freedom.Social.ClientState = {
        userId: 'mockmyself',
        clientId: 'fakemyself',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      }
      spyOn(network['api'], 'login').and.callFake(() => {
        return Promise.resolve(fakeSuccessClient);
      });
      spyOn(network, 'notifyUI');
      network.login().then(() => {
        expect(network['myClient']).toEqual(fakeSuccessClient);
        expect(network['online']).toEqual(true);
        expect(network.notifyUI).toHaveBeenCalled();
      }).then(done);
    });

    it('warns if network login fails', (done) => {
      network['online'] = false;
      spyOn(network['api'], 'login').and.callFake(() => {
        // Pretend the social API's login failed.
        return Promise.reject(new Error('mock failure'));
      });
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
      spyOn(network['api'], 'logout').and.callFake(() => {
        return Promise.resolve();
      });
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

  describe('events & communication', () => {

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

    it('warns if receiving ClientState with userId not in roster', () => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleClient');
      var clientState :freedom.Social.ClientState = {
        userId: 'im_not_here',
        clientId: 'fakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      };
      network.handleClientState(clientState);
      expect(user.handleClient).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
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
        message: null
      };
      network.handleMessage(msg);
      expect(user.handleMessage).toHaveBeenCalledWith(msg);
    });

    it('warns if receiving Message with userId not in roster', () => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleMessage');
      var msg = {
        from: {
          userId: 'im_not_here',
          clientId: 'fakeclient',
          status: freedom.Social.Status.ONLINE,
          timestamp: 12345
        },
        message: null
      };
      network.handleMessage(msg);
      expect(user.handleMessage).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
    });

  });  // describe events & communication

});
