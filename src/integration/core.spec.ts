/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-core-env.d.ts' />
/// <reference path='../../../third_party/typings/lodash/lodash.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts' />


import _ = require('lodash');
import browser_connector = require('../interfaces/browser_connector');
import social = require('../interfaces/social');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');
import net = require('../../../third_party/uproxy-lib/net/net.types');
import credentials = require('./gtalk_credentials');
import mock_oauth = require('./mock_oauth');

import ALICE = credentials.ALICE;
import BOB = credentials.BOB;

var testConnection = (socksEndpoint :net.Endpoint) : Promise<Boolean> => {
  return freedom('files/integration.json', {debug:'log'}).then((freedomInterface :any) => {
    var testModule = new freedomInterface();
    var input = arraybuffers.stringToArrayBuffer('arbitrary test string');
    return testModule.startEchoServer().then((port:number) => {
      return testModule.connect(socksEndpoint, port, "").
          then((connectionId :string) => {
        return testModule.echo(connectionId, input)
            .then((output :ArrayBuffer) => {
          return Promise.resolve(
            arraybuffers.byteEquality(input, output));
        })
      });
    }).catch((e :any) => {
      return Promise.reject(e);
    })
  });
}

describe('uproxy core', function() {
  // TODO: the 'start proxying' test fails with a timeout of less than 10s,
  // and the 'stop proxying' test fails with a timeout of less than 20s.
  // We should speed up these actions!
  // https://github.com/uProxy/uproxy/issues/2247
  (<any>jasmine).DEFAULT_TIMEOUT_INTERVAL = 20000;

  var uProxyFreedom = 'files/generic_core/freedom-module.json';
  var alice :any;
  var bob :any;
  var promiseId = 0;
  var aliceUserPath :social.UserPath;
  var bobUserPath :social.UserPath;
  var aliceOfferingInstanceId :string;
  var bobOfferingInstanceId :string;
  var aliceInstancePath :social.InstancePath;
  var bobInstancePath :social.InstancePath;

  it('loads uproxy', (done) => {
    // Start all tests with empty storage.
    // TODO: find a browser independent call to clear storage using Freedom's
    // core.storage, https://github.com/uProxy/uproxy/issues/2265
    chrome.storage.local.clear(() => {
      // Ensure that aliceSocialInterface and bobSocialInterface are set.
      var alicePromise = freedom(uProxyFreedom,
          <freedom.FreedomInCoreEnvOptions>{
            oauth: [() => { return new mock_oauth.MockOAuth(ALICE.REFRESH_TOKEN) }],
            debug: 'log'
          }).then(function(freedomInterface) {
        alice = freedomInterface();
      });
      var bobPromise = freedom(uProxyFreedom,
          <freedom.FreedomInCoreEnvOptions>{
            oauth: [() => { return new mock_oauth.MockOAuth(BOB.REFRESH_TOKEN) }],
            debug: 'log'
          }).then(function(freedomInterface) {
        bob = freedomInterface();
      });
      Promise.all([alicePromise, bobPromise]).then(done);
    });
    // var storage = new local_storage.Storage();
    // var clearStorage = storage.reset();
    // var freedomStorage  :freedom.Storage.Storage = freedom['core.storage']();
    // var clearStorage = freedomStorage.clear();
  });

  var login = (uProxyModule :any, networkName :string) : Promise<Object> => {
    return new Promise(function(fulfill, reject) {
      var thisPromiseId = ++promiseId;
      uProxyModule.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
        if (data.promiseId === thisPromiseId) {
          fulfill(data);
        }
      });
      uProxyModule.emit(
          '' + uproxy_core_api.Command.LOGIN,
          <browser_connector.PromiseCommand>{
            data: {
              network: networkName,
              loginType: uproxy_core_api.LoginType.TEST
            },
            promiseId: thisPromiseId
          });
    });
  }

  // TODO: we could clean up this code further if the LOGIN command returned
  // the local instanceId - then we wouldn't have to wait until consent
  // is received to set the instanceId and could be 100% sure that the
  // offering/receiving instances matched the instances created by these
  // tests.
  // https://github.com/uProxy/uproxy/issues/2246

  // TODO: emit commands skip proper type checking because they don't use
  // the uProxyCore or CoreConnector classes.  We should switch from emits
  // to using those classes if possible.
  // https://github.com/uProxy/uproxy/issues/2245

  it('logs in', (done) => {
    var promises :Promise<Object>[] = [];

    // Login to GMail with Alice and Bob
    promises.push(login(alice, 'GMail'));
    promises.push(login(bob, 'GMail'));

    promises.push(new Promise(function(fulfill, reject) {
      alice.on('' + uproxy_core_api.Update.USER_FRIEND, (data :any) => {
        if (data.user.userId === BOB.USER_ID
           && data.allInstanceIds.length > 0) {
          fulfill();;
        }
      })
    }));
    promises.push(new Promise(function(fulfill, reject) {
      bob.on('' + uproxy_core_api.Update.USER_FRIEND, (data :any) => {
        if (data.user.userId === ALICE.USER_ID
            && data.allInstanceIds.length > 0) {
          fulfill();
        }
      })
    }));

    Promise.all(promises).then(() => {
      // Need to clear stun servers so tests will pass
      var globalSettings = {
        description: '',
        stunServers: <any>[],
        hasSeenSharingEnabledScreen: true,
        hasSeenWelcome: false,
        hasSeenMetrics: false,
        allowNonUnicast: true,
        statsReportingEnabled: false
      };
      alice.emit('' + uproxy_core_api.Command.UPDATE_GLOBAL_SETTINGS,
                 {data: globalSettings});
      bob.emit('' + uproxy_core_api.Command.UPDATE_GLOBAL_SETTINGS,
               {data: globalSettings});
      done();
    });
  });  // end of it('logs in', ...

  it('ask and get permission', (done) => {
    aliceUserPath = {
      // This is Alice's user relative to Bob's logged in uProxy.
      network: {
        name: 'GMail',
        userId: BOB.USER_ID,
      },
      userId: ALICE.USER_ID
    };
    bobUserPath = {
      // This is Bob's user relative to Alice's logged in uProxy.
      network: {
        name: 'GMail',
        userId: ALICE.USER_ID,
      },
      userId: BOB.USER_ID
    };

    var bobHandleFriend = function(data :any) {
      if (data.user.userId === ALICE.USER_ID
          && data.consent.remoteRequestsAccessFromLocal
          && !data.consent.localGrantsAccessToRemote) {
        bob.off('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);
        bob.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
                 {data: {path: aliceUserPath, action:uproxy_core_api.ConsentUserAction.OFFER}});
      }
    }
    bob.on('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);

    var aliceHandleFriend = function(data :any) {
      if (data.user.userId === BOB.USER_ID
          && data.offeringInstances.length > 0) {
        bobOfferingInstanceId = data.offeringInstances[0].instanceId;
        bobInstancePath = <social.InstancePath>(_.cloneDeep(bobUserPath));
        bobInstancePath.instanceId = bobOfferingInstanceId;
        alice.off('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
        done();
      }
    };
    alice.on('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);

    alice.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
               {data: {path: bobUserPath, action:uproxy_core_api.ConsentUserAction.REQUEST}});
  }); // end of it('ask and get permission', ...

  var startProxying = function() {
    var aliceStarted = new Promise(function(fulfill, reject) {
      alice.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
        expect(data.promiseId).toEqual(promiseId);
        // data.argsForCallback should be endpoints here.
        testConnection(data.argsForCallback).then((proxying) => {
          expect(proxying).toEqual(true);
          fulfill();
        });
      });
    });

    var bobStarted = new Promise(function(fulfill, reject) {
      bob.once('' + uproxy_core_api.Update.START_GIVING_TO_FRIEND, (data :any) => {
        fulfill();
      });
    });

    alice.emit('' + uproxy_core_api.Command.START_PROXYING,
               {data: bobInstancePath, promiseId: ++promiseId});

    return Promise.all([aliceStarted, bobStarted]);
  }

  var stopProxying = function() {
    // alice not proxying
    var bobStopped = new Promise(function(fulfill, reject) {
      bob.once('' + uproxy_core_api.Update.STOP_GIVING_TO_FRIEND, (data :any) => {
        fulfill();
      });
    });

    var aliceStopped = new Promise(function(fulfill, reject) {
      alice.once('' + uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND, (data :any) => {
        expect(data).toEqual({instanceId: bobOfferingInstanceId, error: false});
        fulfill();
      });
    });

    alice.emit('' + uproxy_core_api.Command.STOP_PROXYING,
               {data: bobInstancePath});

    return Promise.all([aliceStopped, bobStopped]);
  }

  it('start proxying', (done) => {
    startProxying().then(done);
  });

  it('stop proxying', (done) => {
    stopProxying().then(done);
  });

  it('start proxying again', (done) => {
    startProxying().then(done);
  });

  it('stop proxying again', (done) => {
    stopProxying().then(done);
  });

  it('log out and modify permissions for offline user', (done) => {
    alice.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
      expect(data.promiseId).toEqual(promiseId);
      bob.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
                       {data: {path: aliceUserPath, action:uproxy_core_api.ConsentUserAction.CANCEL_OFFER}});
      bob.emit('' + uproxy_core_api.Command.LOGOUT,
                 {data: {name: 'GMail', userId: BOB.USER_ID}, promiseId: ++promiseId});
      done();
    });
    alice.emit('' + uproxy_core_api.Command.LOGOUT,
               {data: {name: 'GMail', userId: ALICE.USER_ID}, promiseId: ++promiseId});
  });

  it('log back in and check permissions', (done) => {
    var aliceLoggedIn = login(alice, 'GMail');
    var aliceHandleFriend = function(data :any) {
      // Initially Alice doesn't know that bob has canceled the offer
      // because they haven't both been online so they haven't synced
      // the consent state yet.
      aliceLoggedIn.then(() => {
        if (data.user.userId === BOB.USER_ID
            && data.offeringInstances.length > 0
            && !data.consent.localGrantsAccessToRemote) {
          alice.off('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
          login(bob, 'GMail');
          // After bob logs in, consent state is restored from storage correctly.
          var aliceReceivedConsent = new Promise(function(fulfill, reject) {
            aliceHandleFriend = function(data :any) {
              if (data.user.userId = BOB.USER_ID
                && data.offeringInstances.length === 0
                && data.consent.localGrantsAccessToRemote) {
                alice.off('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
                fulfill();
              }
            }
            alice.on('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
          });
          var bobReceivedConsent = new Promise(function(fulfill, reject) {
            var bobHandleFriend = function(data :any) {
              if (data.user.userId === ALICE.USER_ID
                  && data.offeringInstances.length > 0
                  && data.consent.remoteRequestsAccessFromLocal
                  && !data.consent.localGrantsAccessToRemote) {
                aliceOfferingInstanceId = data.offeringInstances[0].instanceId;
                aliceInstancePath = <social.InstancePath>(_.cloneDeep(aliceUserPath));
                aliceInstancePath.instanceId = aliceOfferingInstanceId;
                bob.off('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);
                fulfill();
              }
            };
            bob.on('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);
          });
          alice.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
                           {data: {path: bobUserPath, action:uproxy_core_api.ConsentUserAction.OFFER}});
          Promise.all([aliceReceivedConsent, bobReceivedConsent]).then(done);
        }
      });
    };
    alice.on('' + uproxy_core_api.Update.NETWORK, (data :any) => {
      if (data.online) {
        alice.on('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
      }
    });
  });

  it('try proxying again', (done) => {
    bob.on('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
      if (data.promiseId === 6) {
        // TODO test proxying data.endpoints
      }
    });
    alice.on('' + uproxy_core_api.Update.START_GIVING_TO_FRIEND, (data :any) => {
      expect(data).toEqual(bobOfferingInstanceId);
      done();
    });
    bob.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
                     {data: {path: aliceUserPath, action:uproxy_core_api.ConsentUserAction.REQUEST}});
    bob.emit('' + uproxy_core_api.Command.START_PROXYING,
               {data: aliceInstancePath, promiseId: ++promiseId});
  });
});
