/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import freedomMocker = require('../../../third_party/uproxy-lib/freedom/mocks/mock-freedom-in-module-env');

import freedom_mocks = require('../mocks/freedom-mocks');
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import social = require('../interfaces/social');

import social_network = require('./social');
import local_storage = require('./storage');
import local_instance = require('./local-instance');
import globals = require('./globals');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

import ui_connector = require('./ui_connector');
import ui = ui_connector.connector;

class MockSocial {
  public on = () => {}
  public emit = () => {}
  public manifest = () => {}
  public login = () => {}
  public logout = () => {}
  public sendMessage = () => { return Promise.resolve(); }
  public inviteUser = () => { return Promise.resolve({data: 'inviteData'}); }
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
  beforeEach(() => {
    // Spy / override log messages to keep test output clean.
    spyOn(console, 'log');
  });

  it('initialize networks', () => {
    social_network.initializeNetworks();
    expect(social_network.networks['badmock']).not.toBeDefined();
    expect(social_network.networks['mock']).toBeDefined();
    expect(social_network.networks['mock']).toEqual({});
  });


  it('begins with empty roster', () => {
    var network = new social_network.FreedomNetwork('mock');
    expect(network.roster).toEqual({});
  });


  describe('login & logout', () => {

    var network = new social_network.FreedomNetwork('mock');
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
        var loginPromise = network.login(false);
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
          network.handleClientState(freedomClientState).then(() => {
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
      network.login(false).catch(done);
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
      var network = new social_network.FreedomNetwork('mock');
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
    var network = new social_network.FreedomNetwork('mock');

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

    it('passes |onClientState| to correct user', (done) => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleClient');
      var freedomClientState :freedom.Social.ClientState = {
        userId: 'mockuser',
        clientId: 'fakeclient',
        status: 'ONLINE',
        timestamp: 12345
      };
      network.handleClientState(freedomClientState).then(() => {
        expect(user.handleClient).toHaveBeenCalledWith(
          social_network.freedomClientToUproxyClient(freedomClientState));
        done();
      });
    });

    it('adds placeholder when receiving ClientState with userId not in roster',
        (done) => {
      var freedomClientState :freedom.Social.ClientState = {
        userId: 'im_not_here',
        clientId: 'fakeclient',
        status: 'ONLINE',
        timestamp: 12345
      };
      network.handleClientState(freedomClientState).then(() => {
        var user = network.getUser('im_not_here');
        expect(user).toBeDefined();
        done();
      });
    });

    it('passes |onMessage| to correct user', (done) => {
      var user = network.getUser('mockuser');
      spyOn(user, 'handleMessage').and.returnValue(Promise.resolve());
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
      network.handleMessage(msg).then(() => {
        expect(user.handleMessage).toHaveBeenCalledWith('fakeclient', {
          'cats': 'meow'
        });
        done();
      });
    });

    it('adds placeholder when receiving Message with userId not in roster', (done) => {
      var msg = {
        from: {
          userId: 'im_still_not_here',
          clientId: 'fakeclient',
          status: 'ONLINE',
          timestamp: 12345
        },
        message: JSON.stringify(VALID_MESSAGE)
      };
      network.handleMessage(msg).then(() => {
        var user = network.getUser('im_still_not_here');
        expect(user).toBeDefined();
        done();
      });
    });

  });  // describe events & communication

  it('JSON.parse and stringify messages at the right layer', (done) => {
    var network = new social_network.FreedomNetwork('mock');
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
    network.handleMessage(inMsg).then(() => {
      expect(JSON.parse).toHaveBeenCalledWith('{"elephants":"have trunks"}');
      var outMsg = {
        type: social.PeerMessageType.INSTANCE,
        data: {
          'tigers': 'are also cats'
        },
        version: globals.MESSAGE_VERSION
      };
      spyOn(JSON, 'stringify').and.callThrough();
      network.send(network.getUser('mockuser'), 'fakeclient', outMsg)
      expect(JSON.stringify).toHaveBeenCalledWith(
        {type: outMsg.type, data: outMsg.data, version: globals.MESSAGE_VERSION});
      done();
    });
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

describe('Quiver social networks', () => {

  var network = new social_network.FreedomNetwork('Quiver');
  var publicKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\nCharset: UTF-8\n\nxv8AAABSBAAAAAATCCqGSM49AwEHAgMET0MCyukhN3K9ZK4FFFjQZH9zgl7IYG49zW+LVy8+yPKMdxJKykvZTfDxtsa0nn+9RTqWKG9icny5WHaP/8jU+c3/AAAACDx1\ncHJveHk+wv8AAACNBBATCAA//wAAAAWCVjlEEP8AAAACiwn/AAAACZCqRSGvko5d\nbf8AAAAFlQgJCgv/AAAAA5YBAv8AAAACmwP/AAAAAp4BAACQ+AD/dRcn2yyBw0pN\naVJ601Yj/mKytbaMinvwEOZLLI7/gw8BAO0CDamDh5Z1qHPdWHX+gcUJhYqphx9m\n8Q/3ZZnHWGbczv8AAABWBAAAAAASCCqGSM49AwEHAgMETQNo4KtL/+I9LnANr0xG\nP9VntACBV3zkkHXeqRV5+VCl3dIY15V8+VlL6zANdDsadEvvo0iK9dZ7zt73jnu8\nGQMBCAfC/wAAAG0EGBMIAB//AAAABYJWOUQQ/wAAAAmQqkUhr5KOXW3/AAAAApsM\nAADfSgD/RXLGk5YW3CGWoUMmMyrsJMsfhxXZjNuEdG81Nes9c0MA/0PVaConDDFO\nx3WbVaa8u9DtnOB5YqdAKhY9Nlo8nyDa\n=7wQP\n-----END PGP PUBLIC KEY BLOCK-----\r\n';
  var message = JSON.stringify({type: 1, data: 'hello'});

  it('can login', (done) => {
    spyOn(network['freedomApi_'], 'login').and.returnValue(
        Promise.resolve(fakeFreedomClient));
    network.login(false, 'Alice').then(done);
  });

  it('Ignores messages from unknown clients', (done) => {
    var unknownClientState :freedom.Social.ClientState = {
      userId: 'mockuser',
      clientId: 'fakeclient',
      status: 'ONLINE',
      timestamp: 12345
    };
    network.handleMessage({from: unknownClientState, message: message})
    .then(() => {
      // User should not have been created, so user.handleMessage
      // should never have been called
      var user = network.getUser('mockuser');
      expect(user).not.toBeDefined();
      done();
    });
  });

  it('Ignores messages if inviteUserData contains invalid permission token', (done) => {
    var validClientState :freedom.Social.ClientState = {
      userId: 'mockuser',
      clientId: 'mockuser:' + publicKey,
      status: 'ONLINE',
      timestamp: 12345,
      // Use clear-text inviteUserData, as mock pgp provider doesn't decrypt
      inviteUserData: JSON.stringify({
        publicKey: publicKey,
        userId: 'mockuser',
        permissionToken: 'invalid'
      })
    };
    network.handleMessage({from: validClientState, message: message})
    .then(() => {
      // User should not have been created, so user.handleMessage
      // should never have been called
      var user = network.getUser('mockuser');
      expect(user).not.toBeDefined();
      done();
    });
  });

  it('Accepts messages if inviteUserData is valid', (done) => {
    var userId = 'mockuser';
    var clientId = userId + ':' + publicKey;

    // Add a user so we can mock handleMessage
    var user = network.addUser(userId);
    spyOn(user, 'handleMessage').and.returnValue(Promise.resolve());

    var permissionToken = network.myInstance.generateInvitePermissionToken();
    var validClientState :freedom.Social.ClientState = {
      userId: userId,
      clientId: clientId,
      status: 'ONLINE',
      timestamp: 12345,
      // Use clear-text inviteUserData, as mock pgp provider doesn't decrypt
      inviteUserData: JSON.stringify({
        publicKey: publicKey,
        userId: userId,
        permissionToken: permissionToken
      })
    };
    network.handleMessage({from: validClientState, message: message})
    .then(() => {
      expect(user.handleMessage).toHaveBeenCalledWith(clientId, JSON.parse(message));
      done();
    });
  });
});
