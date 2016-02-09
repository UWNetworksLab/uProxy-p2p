/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-core-env.d.ts' />


import browser_connector = require('../interfaces/browser_connector');
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
  (<any>jasmine).DEFAULT_TIMEOUT_INTERVAL = 10000;
  var uProxyFreedom = 'files/generic_core/freedom-module.json';
  var alice :any;
  var bob :any;
  var alicePath :Object;
  var bobPath :Object;
  var promiseId = 0;

  it('loads uproxy', (done) => {
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

  it('logs in', (done) => {
    // alice.emit('' + uproxy_core_api.Command.LOGIN,
    //                  <browser_connector.PromiseCommand>{data: {network: 'GMail'}, promiseId: ++promiseId});
    // var aliceLogin = new Promise(function(fulfill, reject) {
    //   alice.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
    //     fulfill();
    //   });
    // });
    // aliceLogin.then(done);

    // TODO: use this!
    var promises :Promise<Object>[] = [];
    alice.emit('' + uproxy_core_api.Command.LOGIN,
                     <browser_connector.PromiseCommand>{data: {network: 'GMail'}, promiseId: ++promiseId});
    promises.push(new Promise(function(fulfill, reject) {
      alice.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
        fulfill();
      });
    }));
    bob.emit('' + uproxy_core_api.Command.LOGIN,
                     <browser_connector.PromiseCommand>{data: {network: 'GMail'}, promiseId: ++promiseId});
    promises.push(new Promise(function(fulfill, reject) {
      bob.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
        fulfill();
      });
    }));
    promises.push(new Promise(function(fulfill, reject) {
      alice.on('' + uproxy_core_api.Update.USER_FRIEND, (data :any) => {
        if (data.user.userId === BOB.ANONYMIZED_ID
           && data.user.name === BOB.NAME
           && data.allInstanceIds.length > 0) {
          BOB.INSTANCE_ID = data.allInstanceIds[0];
          fulfill();;
        }
      })
    }));
    promises.push(new Promise(function(fulfill, reject) {
      bob.on('' + uproxy_core_api.Update.USER_FRIEND, (data :any) => {
        if (data.user.userId === ALICE.ANONYMIZED_ID
            && data.user.name === ALICE.NAME
            && data.allInstanceIds.length > 0) {
          ALICE.INSTANCE_ID = data.allInstanceIds[0];
          fulfill();
        }
      })
    }));

    // TODO: why was this needed?
    Promise.all(promises).then(() => {
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

  // it('ask and get permission', (done) => {
  //   alicePath = {
  //     network: {
  //       name: 'GMail',
  //       userId: BOB.EMAIL,
  //     },
  //     userId: ALICE.ANONYMIZED_ID,
  //     instanceId: ALICE.INSTANCE_ID
  //   };
  //   bobPath = {
  //     network: {
  //       name: 'GMail',
  //       userId: ALICE.EMAIL,
  //     },
  //     userId: BOB.ANONYMIZED_ID,
  //     instanceId: BOB.INSTANCE_ID
  //   };

  //   alice.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
  //                    {data: {path: bobPath, action:uproxy_core_api.ConsentUserAction.REQUEST}});
  //   var bobHandleFriend = function(data :any) {
  //     if (data.user.userId === ALICE.ANONYMIZED_ID
  //         && data.consent.remoteRequestsAccessFromLocal
  //         && !data.consent.localGrantsAccessToRemote) {
  //       bob.off('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);
  //       bob.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
  //                        {data: {path: alicePath, action:uproxy_core_api.ConsentUserAction.OFFER}});
  //     }
  //   }
  //   bob.on('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);

  //   var aliceHandleFriend = function(data :any) {
  //     if (data.user.userId === BOB.ANONYMIZED_ID
  //         && data.offeringInstances.length > 0
  //         && data.offeringInstances[0].instanceId === BOB.INSTANCE_ID) {
  //       alice.off('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
  //       done();
  //     }
  //   };
  //   alice.on('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
  // });
  // var startProxying = function() {
  //   alice.emit('' + uproxy_core_api.Command.START_PROXYING,
  //              {data: bobPath, promiseId: ++promiseId});
  //   var aliceStarted = new Promise(function(fulfill, reject) {
  //     alice.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
  //       expect(data.promiseId).toEqual(promiseId);
  //       // data.argsForCallback should be endpoints here.
  //       testConnection(data.argsForCallback).then((proxying) => {
  //         expect(proxying).toEqual(true);
  //         fulfill();
  //       });
  //     });
  //   });

  //   var bobStarted = new Promise(function(fulfill, reject) {
  //     bob.once('' + uproxy_core_api.Update.START_GIVING_TO_FRIEND, (data :any) => {
  //       expect(data).toEqual(ALICE.INSTANCE_ID);
  //       fulfill();
  //     });
  //   });

  //   return Promise.all([aliceStarted, bobStarted]);
  // }

  // var stopProxying = function() {
  //    alice.emit('' + uproxy_core_api.Command.STOP_PROXYING,
  //              {data: bobPath});
  //   // alice not proxying
  //   var bobStopped = new Promise(function(fulfill, reject) {
  //     bob.once('' + uproxy_core_api.Update.STOP_GIVING_TO_FRIEND, (data :any) => {
  //       expect(data).toEqual(ALICE.INSTANCE_ID);
  //       fulfill();
  //     });
  //   });

  //   var aliceStopped = new Promise(function(fulfill, reject) {
  //     alice.once('' + uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND, (data :any) => {
  //       expect(data).toEqual({instanceId: BOB.INSTANCE_ID, error: false});
  //       fulfill();
  //     });
  //   });

  //   return Promise.all([aliceStopped, bobStopped]);
  // }

  // it('start proxying', (done) => {
  //   startProxying().then(done);
  // });

  // it('stop proxying', (done) => {
  //   stopProxying().then(done);
  // });

  // it('start proxying again', (done) => {
  //   startProxying().then(done);
  // });

  // it('stop proxying again', (done) => {
  //   stopProxying().then(done);
  // });

  // it('log out and modify permissions for offline user', (done) => {
  //   alice.emit('' + uproxy_core_api.Command.LOGOUT,
  //              {data: {name: 'GMail', userId: ALICE.EMAIL}, promiseId: ++promiseId});

  //   alice.once('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
  //     expect(data.promiseId).toEqual(promiseId);
  //     bob.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
  //                      {data: {path: alicePath, action:uproxy_core_api.ConsentUserAction.CANCEL_OFFER}});
  //     bob.emit('' + uproxy_core_api.Command.LOGOUT,
  //                {data: {name: 'GMail', userId: BOB.EMAIL}, promiseId: ++promiseId});
  //     done();
  //   });
  // });

  // it('log back in and check permissions', (done) => {
  //   alice.emit('' + uproxy_core_api.Command.LOGIN,
  //              {data: 'GMail', promiseId: ++promiseId});
  //   var aliceLoggedIn = new Promise((F, R) => {
  //     alice.on('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
  //       if (data.promiseId === promiseId) {
  //         F();
  //       }
  //     });
  //   });
  //   var aliceHandleFriend = function(data :any) {
  //     // Initially Alice doesn't know that bob has canceled the offer
  //     // because they haven't both been online so they haven't synced
  //     // the consent state yet.
  //     aliceLoggedIn.then(() => {
  //       if (data.user.userId === BOB.ANONYMIZED_ID
  //           && data.offeringInstances.length > 0
  //           && data.offeringInstances[0].instanceId === BOB.INSTANCE_ID
  //           && !data.consent.localGrantsAccessToRemote) {
  //         alice.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
  //                          {data: {path: bobPath, action:uproxy_core_api.ConsentUserAction.OFFER}});
  //         alice.off('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
  //         bob.emit('' + uproxy_core_api.Command.LOGIN,
  //                  {data: 'GMail', promiseId: ++promiseId});
  //         // After bob logs in, consent state is restored from storage correctly.
  //         var aliceReceivedConsent = new Promise(function(fulfill, reject) {
  //           aliceHandleFriend = function(data :any) {
  //             if (data.user.userId = BOB.ANONYMIZED_ID
  //               && data.offeringInstances.length === 0
  //               && data.consent.localGrantsAccessToRemote) {
  //               alice.off('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
  //               fulfill();
  //             }
  //           }
  //           alice.on('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
  //         });
  //         var bobReceivedConsent = new Promise(function(fulfill, reject) {
  //           var bobHandleFriend = function(data :any) {
  //             if (data.user.userId === ALICE.ANONYMIZED_ID
  //                 && data.offeringInstances.length > 0
  //                 && data.offeringInstances[0].instanceId === ALICE.INSTANCE_ID
  //                 && data.consent.remoteRequestsAccessFromLocal
  //                 && !data.consent.localGrantsAccessToRemote) {
  //               bob.off('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);
  //               fulfill();
  //             }
  //           };
  //           bob.on('' + uproxy_core_api.Update.USER_FRIEND, bobHandleFriend);
  //         });
  //         Promise.all([aliceReceivedConsent, bobReceivedConsent]).then(done);
  //       }
  //     });
  //   };
  //   alice.on('' + uproxy_core_api.Update.NETWORK, (data :any) => {
  //     if (data.online) {
  //       alice.on('' + uproxy_core_api.Update.USER_FRIEND, aliceHandleFriend);
  //     }
  //   });
  // });

  // it('try proxying again', (done) => {
  //   bob.emit('' + uproxy_core_api.Command.MODIFY_CONSENT,
  //                    {data: {path: alicePath, action:uproxy_core_api.ConsentUserAction.REQUEST}});
  //   bob.emit('' + uproxy_core_api.Command.START_PROXYING,
  //              {data: alicePath, promiseId: ++promiseId});
  //   bob.on('' + uproxy_core_api.Update.COMMAND_FULFILLED, (data :any) => {
  //     if (data.promiseId === 6) {
  //       // TODO test proxying data.endpoints
  //     }
  //   });

  //   alice.on('' + uproxy_core_api.Update.START_GIVING_TO_FRIEND, (data :any) => {
  //     expect(data).toEqual(BOB.INSTANCE_ID);
  //     done();
  //   });
  // });
});
