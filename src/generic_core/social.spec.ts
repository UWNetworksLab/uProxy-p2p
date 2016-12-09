import * as freedomMocker from '../lib/freedom/mocks/mock-freedom-in-module-env';

import * as freedom_mocks from '../mocks/freedom-mocks';
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.online': () => { return new freedom_mocks.MockFreedomOnline(); },
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import * as social from '../interfaces/social';
import * as rappor_metrics from './metrics';
import * as social_network from './social';
import * as local_storage from './storage';
import * as local_instance from './local-instance';
import * as constants from './constants';
import * as uproxy_core_api from '../interfaces/uproxy_core_api';

import * as ui_connector from './ui_connector';
import ui = ui_connector.connector;


class MockSocial {
  public on = () => {}
  public emit = () => {}
  public manifest = () => {}
  public login = () => {}
  public logout = () => {}
  public sendMessage = () => { return Promise.resolve(); }
  public inviteUser = () => { return Promise.resolve({data: 'InviteTokenData'}); }
}

// Valid message that won't have side effects on network/user/instance objects.
var VALID_MESSAGE = {
  type: social.PeerMessageType.INSTANCE_REQUEST,
  data: <any>null
};

var freedomClient :freedom.Social.ClientState = {
  userId: 'mockmyself',
  clientId: 'fakemyself',
  status: 'ONLINE',
  timestamp: 12345
};

var fakeFreedomClient :freedom.Social.ClientState = {
  userId: 'mockmyself',
  clientId: 'fakemyself',
  status: 'ONLINE',
  timestamp: 12345
};

describe('freedomClientToUproxyClient', () => {
  beforeEach(() => {
    spyOn(console, 'log');
  });
  var uproxyClient = social_network.freedomClientToUproxyClient(freedomClient);

  it('converts status to enum', () => {
    expect(uproxyClient.status).toEqual(social.ClientStatus.ONLINE);
  });

  it('copies non-status fields unchanged', () => {
    expect(uproxyClient.userId).toEqual(freedomClient.userId);
    expect(uproxyClient.clientId).toEqual(freedomClient.clientId);
    expect(uproxyClient.timestamp).toEqual(freedomClient.timestamp);
  });
});

describe('social_network.FreedomNetwork', () => {

  // Mock social providers.
  freedom['SOCIAL-badmock'] = <any>(() => { return new MockSocial(); });
  freedom['SOCIAL-mock'] = <any>(() => { return new MockSocial(); });
  freedom['SOCIAL-mock'].api = 'social';
  freedom['SOCIAL-Quiver'] = <any>(() => { return new MockSocial(); });
  freedom['SOCIAL-Quiver'].api = 'social2';

  var loginPromise :Promise<void>;
  var metrics :rappor_metrics.Metrics;
  beforeEach(() => {
    // Spy / override log messages to keep test output clean.
    spyOn(console, 'log');
    metrics = new rappor_metrics.FreedomMetrics(null);
  });

  it('initialize networks', () => {
    social_network.initializeNetworks();
    expect(social_network.networks['badmock']).not.toBeDefined();
    expect(social_network.networks['mock']).toBeDefined();
    expect(social_network.networks['mock']).toEqual({});
  });


  it('begins with empty roster', () => {
    var network = new social_network.FreedomNetwork('mock', metrics);
    expect(network.roster).toEqual({});
  });


  describe('login & logout', () => {

    var network = new social_network.FreedomNetwork('mock', metrics);
    it('can log in', (done) => {
      // TODO: figure out how jasmine clock works and add it back
      // jasmine.clock().install();
      var storage = new local_storage.Storage;
      var fulfillFunc :Function;
      var onceLoggedIn = new Promise((F, R) => { fulfillFunc = F; });
      spyOn(network['freedomApi_'], 'login').and.returnValue(onceLoggedIn);

      var fulfillStorage :Function;
      var onceStorageDone =  new Promise((F, R) => { fulfillStorage = F; });
      var restoreFunc = network.restoreFromStorage.bind(network);
      spyOn(network, 'restoreFromStorage').and.callFake(() => {
        restoreFunc().then(() => {
          fulfillStorage();
        })
      });

      var savedToStorage :Promise<void>[] = [];
      savedToStorage.push(storage.save('mockmockmyself', {
          instanceId: 'dummy-instance-id',
          keyHash: '',
          bytesReceived: 0,
          bytesSent: 0,
          description: 'my computer',
          isOnline: false,
          localGettingFromRemote: social.GettingState.NONE,
          localSharingWithRemote: social.SharingState.NONE
      }));
      savedToStorage.push(storage.save(
          'dummy-instance-id/roster/somefriend', ''));

      Promise.all(savedToStorage).then(() => {
        loginPromise = network.login(uproxy_core_api.LoginType.INITIAL);
        return loginPromise;
      }).then(() => {
        expect(network.myInstance).toBeDefined();
        expect(network['myInstance'].userId).toEqual(
            fakeFreedomClient.userId);
        expect(network['myInstance'].instanceId).toEqual(
            'dummy-instance-id');
        var freedomClientState :freedom.Social.ClientState = {
          userId: 'fakeuser',
          clientId: 'fakeclient',
          status: 'ONLINE',
          timestamp: 12345
        };
        onceStorageDone.then(() => {
          expect(Object.keys(network.roster).length).toEqual(1);
          expect(network.getUser('somefriend')).toBeDefined();
          // Add user to the roster;
          network.handleClientState(freedomClientState);
          expect(Object.keys(network.roster).length).toEqual(2);
          var friend = network.getUser('fakeuser');
          expect(friend).toBeDefined();
          //spyOn(friend, 'monitor');
          // Advance clock 5 seconds and make sure monitoring was called.
          // jasmine.clock().tick(60000);
          //expect(friend.monitor).toHaveBeenCalled();
          done();
        });
      });
      fulfillFunc(fakeFreedomClient);
      // We need to tick a clock in order promises to be resolved.
      //jasmine.clock().tick(1);
    });

    it('errors if network login fails', (done) => {
      loginPromise = network['onceLoggedIn_'];
      network['onceLoggedIn_'] = null;
      // Pretend the social API's login failed.
      spyOn(network['freedomApi_'], 'login').and.returnValue(
          Promise.reject(new Error('mock failure')));
      network.login(uproxy_core_api.LoginType.INITIAL).catch(done);
      //jasmine.clock().tick(1);
    });

    it('can log out', (done) => {
      network['onceLoggedIn_'] = loginPromise;
      // Pretend the social API's logout succeeded.
      spyOn(network['freedomApi_'], 'logout').and.returnValue(Promise.resolve());

      var friend = network.getUser('fakeuser');
      expect(friend).toBeDefined();
      //spyOn(friend, 'monitor');
      // Monitoring is still running.
      //jasmine.clock().tick(60000);
      //expect(friend.monitor).toHaveBeenCalled();

      network.logout().then(() => {
        // (<any>friend.monitor).calls.reset();
        // jasmine.clock().tick(60000);
        // expect(friend.monitor).not.toHaveBeenCalled();
        // jasmine.clock().uninstall();
      }).then(done);
      // We need to tick a clock in order promises to be resolved.
      // jasmine.clock().tick(1);
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
      var network = new social_network.FreedomNetwork('mock', metrics);
      spyOn(network['freedomApi_'], 'login').and.returnValue(
          new Promise((F, R) => {
            fakeLoginFulfill = F;
          }));
      expect(network['onceLoggedIn_']).toBeDefined();
      network.login(uproxy_core_api.LoginType.INITIAL);  // Will complete in the next spec.
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
    var network = new social_network.FreedomNetwork('mock', metrics);

    it('adds a new user for |onUserProfile|', (done) => {
      network.myInstance = new local_instance.LocalInstance(network, 'fakeId');
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
      done();
    });

    it('updates existing user', (done) => {
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
      done();
    });

    it('passes |onClientState| to correct user', () => {
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
        social_network.freedomClientToUproxyClient(freedomClientState));
    });

    it('adds placeholder when receiving ClientState with userId not in roster',
        () => {
      var freedomClientState :freedom.Social.ClientState = {
        userId: 'im_not_here',
        clientId: 'fakeclient',
        status: 'ONLINE',
        timestamp: 12345
      };
      network.handleClientState(freedomClientState);
      var user = network.getUser('im_not_here');
      expect(user).toBeDefined();
    });

    it('passes |onMessage| to correct user', () => {
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
      var msg = {
        from: {
          userId: 'im_still_not_here',
          clientId: 'fakeclient',
          status: 'ONLINE',
          timestamp: 12345
        },
        message: JSON.stringify(VALID_MESSAGE)
      };
      network.handleMessage(msg);
      var user = network.getUser('im_still_not_here');
      expect(user).toBeDefined();
    });

  });  // describe events & communication

  it('JSON.parse and stringify messages at the right layer', () => {
    var network = new social_network.FreedomNetwork('mock', metrics);
    spyOn(network, 'getStorePath').and.returnValue('');
    network['myInstance'] =
            new local_instance.LocalInstance(network, 'localUserId');
    var user = network.addUser('mockuser');
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
      type: social.PeerMessageType.INSTANCE,
      data: {
        'tigers': 'are also cats'
      },
      version: constants.MESSAGE_VERSION
    };
    spyOn(JSON, 'stringify').and.callThrough();
    network.send(network.getUser('mockuser'), 'fakeclient', outMsg)
    expect(JSON.stringify).toHaveBeenCalledWith(
      { type: outMsg.type, data: outMsg.data, version: constants.MESSAGE_VERSION });
  });

  // TODO: get this unit test to pass.
  /*
  it('Can restore a state that has multiple users', (done) => {
    var networkState :social.NetworkState = {
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
