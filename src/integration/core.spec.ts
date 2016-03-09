/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-core-env.d.ts' />
/// <reference path='../../../third_party/typings/lodash/lodash.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts' />


import _ = require('lodash');
import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');
import CoreConnector = require('../generic_ui/scripts/core_connector');
import credentials = require('./gtalk_credentials');
import IntegrationTestConnector = require('./integration_test_connector');
import loggingTypes = require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
import mock_oauth = require('./mock_oauth');
import net = require('../../../third_party/uproxy-lib/net/net.types');
import social = require('../interfaces/social');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import user_interface = require('../interfaces/ui');

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

  var alice :CoreConnector;
  var bob :CoreConnector;
  var promiseId = 0;
  var aliceUserPath :social.UserPath;
  var bobUserPath :social.UserPath;
  var aliceInstanceId :string;
  var bobInstanceId :string;
  var aliceInstancePath :social.InstancePath;
  var bobInstancePath :social.InstancePath;

  // TODO: all integration tests cases currently depend on the prior tests,
  // we should modify these to not depend on ordering:
  // https://github.com/uProxy/uproxy/issues/2250

  it('loads uproxy', (done) => {
    // Start all tests with empty storage.
    // TODO: find a browser independent call to clear storage using Freedom's
    // core.storage, https://github.com/uProxy/uproxy/issues/2265
    chrome.storage.local.clear(() => {
      var initializeAlice = createFreedomModule(ALICE.REFRESH_TOKEN)
      .then((freedomModule :any) => {
        alice = new CoreConnector(
          new IntegrationTestConnector(freedomModule));
      });
      var initializeBob = createFreedomModule(BOB.REFRESH_TOKEN)
      .then((freedomModule :any) => {
        bob = new CoreConnector(
          new IntegrationTestConnector(freedomModule));
      });
      Promise.all([initializeAlice, initializeBob]).then(done);
    });
  });

  var login = (core :CoreConnector, networkName :string) : Promise<string> => {
    return core.login({
      network: networkName,
      loginType: uproxy_core_api.LoginType.TEST
    }).then((loginResult :uproxy_core_api.LoginResult) => {
      return loginResult.instanceId;
    });
  };

  it('logs in', (done) => {
    var promises :Promise<void>[] = [];

    // Login to GMail with Alice and Bob
    promises.push(login(alice, 'GMail').then((instanceId :string) => {
      aliceUserPath = {
        // This is Alice's user relative to Bob's logged in uProxy.
        network: {
          name: 'GMail',
          userId: BOB.USER_ID,
        },
        userId: ALICE.USER_ID
      };
      aliceInstanceId = instanceId;
      aliceInstancePath = <social.InstancePath>(_.cloneDeep(aliceUserPath));
      aliceInstancePath.instanceId = aliceInstanceId;
    }));
    promises.push(login(bob, 'GMail').then((instanceId :string) => {
      bobUserPath = {
        // This is Bob's user relative to Alice's logged in uProxy.
        network: {
          name: 'GMail',
          userId: ALICE.USER_ID,
        },
        userId: BOB.USER_ID
      };
      bobInstanceId = instanceId;
      bobInstancePath = <social.InstancePath>(_.cloneDeep(bobUserPath));
      bobInstancePath.instanceId = bobInstanceId;
    }));

    promises.push(new Promise<void>(function(fulfill, reject) {
      alice.onUpdate(uproxy_core_api.Update.USER_FRIEND, (data :social.UserData) => {
        if (data.user.userId === BOB.USER_ID
           && data.allInstanceIds.length > 0) {
          fulfill();;
        }
      })
    }));
    promises.push(new Promise<void>(function(fulfill, reject) {
      bob.onUpdate(uproxy_core_api.Update.USER_FRIEND, (data :social.UserData) => {
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
      alice.updateGlobalSettings(<uproxy_core_api.GlobalSettings>globalSettings);
      bob.updateGlobalSettings(<uproxy_core_api.GlobalSettings>globalSettings);
      done();
    });
  });  // end of it('logs in', ...

  function hasInstance(instanceArray :social.InstanceData[], id :string) : boolean {
    for (var i = 0; i < instanceArray.length; ++i) {
      if (instanceArray[i].instanceId === id) {
        return true;
      }
    }
    return false;
  }

  it('ask and get permission', (done) => {
    // CONSIDER: we could remove the use of _.once if CoreConnector had an
    // .off(..) method to stop listening to updates.
    var bobModifyConsent = _.once(() => {
      bob.modifyConsent({path: aliceUserPath, action:uproxy_core_api.ConsentUserAction.OFFER});
    });
    bob.onUpdate(uproxy_core_api.Update.USER_FRIEND, (data :social.UserData) => {
      if (data.user.userId === ALICE.USER_ID
          && data.consent.remoteRequestsAccessFromLocal
          && !data.consent.localGrantsAccessToRemote) {
        // Bob now has a REQUEST from Alice, Bob will now reply with OFFER.
        bobModifyConsent();
      }
    });

    // Complete this test case once Alice has received an offer from
    // bobInstanceId.
    alice.onUpdate(uproxy_core_api.Update.USER_FRIEND, (data :social.UserData) => {
      if (data.user.userId === BOB.USER_ID
          && hasInstance(data.offeringInstances, bobInstanceId)) {
        done();
      }
    });

    alice.modifyConsent({path: bobUserPath, action:uproxy_core_api.ConsentUserAction.REQUEST});
  }); // end of it('ask and get permission', ...

  var startProxying = function() {
    var bobStarted = new Promise<void>(function(fulfill, reject) {
      bob.onUpdate(uproxy_core_api.Update.START_GIVING_TO_FRIEND, (data :any) => {
        fulfill();
      });
    });

    var aliceStarted = alice.start(bobInstancePath)
        .then((socksEndpoint :net.Endpoint) => {
          return testConnection(socksEndpoint);
        }).then((proxying :boolean) => {
          expect(proxying).toEqual(true);
        });

    return Promise.all([aliceStarted, bobStarted]);
  }

  var stopProxying = function() {
    var bobStopped = new Promise(function(fulfill, reject) {
      bob.onUpdate(uproxy_core_api.Update.STOP_GIVING_TO_FRIEND, (data :any) => {
        fulfill();
      });
    });

    var aliceStopped = new Promise(function(fulfill, reject) {
      alice.onUpdate(uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND, (data :any) => {
        expect(data).toEqual({instanceId: bobInstanceId, error: false});
        fulfill();
      });
    });

    alice.stop(bobInstancePath);

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
    alice.logout({name: 'GMail', userId: ALICE.USER_ID}).then((data :any) => {
      bob.modifyConsent({path: aliceUserPath, action:uproxy_core_api.ConsentUserAction.CANCEL_OFFER});
      bob.logout({name: 'GMail', userId: BOB.USER_ID}).then(done);
    });
  });

  it('logs back in and checks permissions', (done) => {
    var aliceLostPermission = new Promise((F, R) => {
      login(alice, 'GMail').then((data :any) => {
        alice.onUpdate(uproxy_core_api.Update.USER_FRIEND, (friend :social.UserData) => {
          if (friend.user.userId === BOB.USER_ID
              && hasInstance(friend.offeringInstances, bobInstanceId)
              && !friend.consent.localGrantsAccessToRemote) {
            // Alice now sees that Bob canceled permission while she was offline.
            F();
          }
        });
      });
    });
    aliceLostPermission.then(() => {
      login(bob, 'GMail').then(done);
    })
  });

  it('modifies permission after re-login', (done) => {
    // Alice and Bob are logged in at this point.  Alice no longer has
    // access to proxy through Bob.  Alice now grants Bob access to proxy
    // though her.
    // CONSIDER: we could remove the use of _.once if CoreConnector had an
    // .off(..) method to stop listening to updates.
    var bobModifyConsent = _.once(() => {
      bob.modifyConsent({path: aliceUserPath, action:uproxy_core_api.ConsentUserAction.REQUEST});
      done();
    });
    bob.onUpdate(uproxy_core_api.Update.USER_FRIEND, (friend :social.UserData) => {
      if (friend.user.userId === ALICE.USER_ID
          && hasInstance(friend.offeringInstances, aliceInstanceId)
          && friend.consent.remoteRequestsAccessFromLocal
          && !friend.consent.localGrantsAccessToRemote) {
        // Bob is now granted access to proxy through Alice,
        // he needs to accept (REQUEST) this in order to continue.
        bobModifyConsent();
      }
    });
    alice.modifyConsent({path: bobUserPath, action:uproxy_core_api.ConsentUserAction.OFFER});
  });

  it('try proxying again', (done) => {
    var aliceStartedSharing = new Promise<void>((F, R) => {
      alice.onUpdate(uproxy_core_api.Update.START_GIVING_TO_FRIEND, (data :any) => {
        expect(data).toEqual(bobInstanceId);
        F();
      });
    });
    var bobStartedGetting = bob.start(aliceInstancePath);
    Promise.all<any>([aliceStartedSharing, bobStartedGetting]).then(done);
  });
});

function createFreedomModule(gmailRefreshToken ?:string) : Promise<any> {
  var options :any = {debug: 'log'};
  if (gmailRefreshToken) {
    options['oauth'] = [
      () => { return new mock_oauth.MockOAuth(gmailRefreshToken) }
    ];
  }
  return new Promise<any>((F, R) => {
    freedom('files/generic_core/freedom-module.json',
            <freedom.FreedomInCoreEnvOptions>options)
    .then((freedomInterface) => {
      F(freedomInterface());
    });
  });
}
