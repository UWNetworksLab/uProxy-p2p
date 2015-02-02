/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../uproxy.ts' />

var REDIRECT_URL = 'http://localhost';
var CLIENT_ID =
    '746567772449-mv4h0e34orsf6t6kkbbht22t9otijip0.apps.googleusercontent.com';
var CLIENT_SECRET = 'M-EGTuFRaWLS5q_hygpJZMBu';

var ALICE = {
  EMAIL: 'alicefreedomxmpp@gmail.com',
  NAME: 'Alice Freedom',
  REFRESH_TOKEN:
      '1/p8X36mT_Ugq4wJfC8emXFnpIMn9Ojj1zxNpmjdVq3js',
  ANONYMIZED_ID: '3bbk93gplwqcn3abf19ivuh6s5@public.talk.google.com'
};
var BOB = {
  EMAIL: 'bobfreedomxmpp@gmail.com',
  NAME: 'Bob Freedom',
  REFRESH_TOKEN:
      '1/RT6ACx5aMr5Mcfa8P-uIo4dHBillQoJmEukALkbJWNw',
  ANONYMIZED_ID: '2s1np2b5ca5gg3tnbwbto4vscs@public.talk.google.com',
};

var OAuthView = function() {};
OAuthView.prototype.initiateOAuth = function(redirectURIs, continuation) {
  continuation({redirect: REDIRECT_URL, state: ''});
  return true;
};
OAuthView.prototype.launchAuthFlow = function(authUrl, stateObj, continuation) {
  if (!this.refreshToken) {
    continuation(undefined, 'No refreshToken set.');
    return;
  }
  return Helper.getAccessToken(this.refreshToken).then(function(accessToken) {
    continuation(REDIRECT_URL + '?access_token=' + accessToken);
  }).catch(function(e) {
    continuation(undefined, 'Failed to get access token');
  });
};

var Helper = {
  // Returns a Promise that fulfills with an access token.
  getAccessToken: function(refreshToken) {
    return new Promise(function(fulfill, resolve) {
      var data = 'refresh_token=' + refreshToken +
          '&client_id=' + CLIENT_ID +
          '&client_secret=' + CLIENT_SECRET +
          '&grant_type=refresh_token';
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/oauth2/v3/token', true);
      xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
      xhr.onload = function() {
        fulfill(JSON.parse(this.response).access_token);
      };
      xhr.send(data);
    });
  },
  // Sets up an onClientState listener and invokes the callback function
  // anytime a new client for the given userId appears as ONLINE.
  onClientOnline: function(socialClient, userId, callback) {
    socialClient.on('onClientState', function(clientState) {
      if (clientState.userId == userId &&
          clientState.status == 'ONLINE' &&
          !Helper.onlineClientIds[clientState.clientId]) {
        // Mark this client as online so we don't re-invoke the callback
        // extra times (e.g. when only lastUpdated has changed.)
        Helper.onlineClientIds[clientState.clientId] = true;
        callback(clientState);
      }
    });
  },
  onlineClientIds: {}
};  // end of Helper

describe('uproxy core', function() {
  var uProxyFreedom = 'scripts/build/compile-src/integration/scripts/freedom-module.json';
  var alice;
  var bob;
  var alicePath;
  var bobPath;
  it('loads uproxy', (done) => {
    // Ensure that aliceSocialInterface and bobSocialInterface are set.
    AliceOAuthView = function() {};
    AliceOAuthView.prototype = new OAuthView();
    AliceOAuthView.prototype.refreshToken = ALICE.REFRESH_TOKEN;
    BobOAuthView = function() {};
    BobOAuthView.prototype = new OAuthView();
    BobOAuthView.prototype.refreshToken = BOB.REFRESH_TOKEN;
    var alicePromise = freedom(uProxyFreedom,
        {oauth: [AliceOAuthView], debug: 'log'})
        .then(function(interface) {
      alice = interface();
    });
    var bobPromise = freedom(uProxyFreedom,
        {oauth: [BobOAuthView], debug: 'log'})
        .then(function(interface) {
      bob = interface();
    });
    Promise.all([alicePromise, bobPromise]).then(done);
  });

  it('logs in', (done) => {
    alice.emit('' + uProxy.Command.LOGIN,
                     <uProxy.PromiseCommand>{data: 'Google', promiseId: 1});
    bob.emit('' + uProxy.Command.LOGIN,
                     <uProxy.PromiseCommand>{data: 'Google', promiseId: 1});
    var aliceLoaded = new Promise(function(fulfill, reject) {
      alice.on('' + uProxy.Update.USER_FRIEND, (data) => {
        if (data.user.userId === BOB.ANONYMIZED_ID && data.instances.length > 0) {
          BOB.INSTANCE_ID = data.instances[0].instanceId;
          fulfill();;
        }
      })
    });
    var bobLoaded = new Promise(function(fulfill, reject) {
      bob.on('' + uProxy.Update.USER_FRIEND, (data) => {
        if (data.user.userId === ALICE.ANONYMIZED_ID && data.instances.length > 0) {
          ALICE.INSTANCE_ID = data.instances[0].instanceId;
          fulfill();
        }
      })
    });
    Promise.all([aliceLoaded, bobLoaded]).then(done);
  });

  it('ask and get permission', (done) => {
    alicePath = {
      network: {
        name: 'Google',
        userId: BOB.EMAIL,
      },
      userId: ALICE.ANONYMIZED_ID,
      instanceId: ALICE.INSTANCE_ID
    };
    bobPath = {
      network: {
        name: 'Google',
        userId: ALICE.EMAIL,
      },
      userId: BOB.ANONYMIZED_ID,
      instanceId: BOB.INSTANCE_ID
    };

    alice.emit('' + uProxy.Command.MODIFY_CONSENT,
                     {data: {path: bobPath, action:Consent.UserAction.REQUEST}});
    bob.on('' + uProxy.Update.USER_FRIEND, (data) => {
      if (data.user.userId === ALICE.ANONYMIZED_ID && data.instances.length > 0
          && data.instances[0].instanceId === ALICE.INSTANCE_ID
          && data.instances[0].consent.remoteRequestsAccessFromLocal
          && !data.instances[0].consent.localGrantsAccessToRemote) {
        console.log(data.instances[0].consent.localGrantsAccessToRemote);
        bob.emit('' + uProxy.Command.MODIFY_CONSENT,
                         {data: {path: alicePath, action:Consent.UserAction.OFFER}});
      }
    });

    alice.on('' + uProxy.Update.USER_FRIEND, (data) => {
      if (data.user.userId === BOB.ANONYMIZED_ID && data.instances.length > 0
          && data.instances[0].instanceId === BOB.INSTANCE_ID
          && data.instances[0].consent.remoteGrantsAccessToLocal) {
        done();
      }
    });
  });

  it('start proxying', (done) => {
    alice.emit('' + uProxy.Command.START_PROXYING,
               {data: bobPath, promiseId: 2});
    alice.on('' + uProxy.Update.COMMAND_FULFILLED, (data) => {
      if (data.promiseId === 2) {
        // TODO test proxying data.endpoints
      }
    });

    bob.on('' + uProxy.Update.START_GIVING_TO_FRIEND, (data) => {
      expect(data).toEqual(ALICE.INSTANCE_ID);
      done();
    });
  });

  it('stop proxying', (done) => {
    alice.emit('' + uProxy.Command.STOP_PROXYING,
               {data: bobPath});
    // alice not proxying
    bob.on('' + uProxy.Update.STOP_GIVING_TO_FRIEND, (data) => {
      expect(data).toEqual(ALICE.INSTANCE_ID);
      done();
    });
  });

  it('start proxying again', (done) => {
    alice.emit('' + uProxy.Command.START_PROXYING,
               {data: bobPath, promiseId: 2});
    alice.on('' + uProxy.Update.COMMAND_FULFILLED, (data) => {
      if (data.promiseId === 2) {
        // TODO test proxying data.endpoints
      }
    });

    bob.on('' + uProxy.Update.START_GIVING_TO_FRIEND, (data) => {
      expect(data).toEqual(ALICE.INSTANCE_ID);
      done();
    });
  });

  it('stop proxying again', (done) => {
    alice.emit('' + uProxy.Command.STOP_PROXYING,
               {data: bobPath});
    // alice not proxying
    bob.on('' + uProxy.Update.STOP_GIVING_TO_FRIEND, (data) => {
      expect(data).toEqual(ALICE.INSTANCE_ID);
      done();
    });
  });

  it('log out', (done) => {
    alice.emit('' + uProxy.Command.LOGOUT,
               {data: {name: 'Google', userId: ALICE.EMAIL}, promiseId: 5});
    alice.on('' + uProxy.Update.COMMAND_FULFILLED, (data) => {
      if (data.promiseId === 5) {
        //bob.emit('' + uProxy.Command.MODIFY_CONSENT,
        //                 {data: {path: alicePath, action:Consent.UserAction.CANCEL_OFFER}});
        bob.emit('' + uProxy.Command.LOGOUT,
                   {data: {name: 'Google', userId: BOB.EMAIL}, promiseId: 3});
        done();
      }
    });
  });

  it('log back in and check permissions', (done) => {
    alice.emit('' + uProxy.Command.LOGIN,
               {data: 'Google', promiseId: 10});
    alice.on('' + uProxy.Update.USER_FRIEND, (data) => {
      console.log(data);
      done();
      if (data.user.userId === BOB.ANONYMIZED_ID && data.instances.length > 0
          && data.instances[0].instanceId === BOB.INSTANCE_ID
          && data.instances[0].consent.remoteGrantssAccessToLocal) {
        alice.emit('' + uProxy.Command.MODIFY_CONSENT,
                         {data: {path: bobPath, action:Consent.UserAction.OFFER}});
        bob.emit('' + uProxy.Command.LOGIN,
                 {data: 'Google', promiseId: 3});
        bob.on('' + uProxy.Update.USER_FRIEND, (data) => {
          if (data.user.userId === ALICE.ANONYMIZED_ID && data.instances.length > 0
              && data.instances[0].instanceId === ALICE.INSTANCE_ID
              && data.instances[0].consent.remoteRequestsAccessFromLocal
              && !data.instances[0].consent.localGrantsAccessToRemote
              && data.instances[0].consent.remoteGrantsAccessToLocal) {
          }
        });
      }
    });
  });

/*
  it('try proxying again', (done) => {
    bob.emit('' + uProxy.Command.MODIFY_CONSENT,
                     {data: {path: alicePath, action:Consent.UserAction.REQUEST}});
    bob.emit('' + uProxy.Command.START_PROXYING,
               {data: alicePath, promiseId: 6});
    bob.on('' + uProxy.Update.COMMAND_FULFILLED, (data) => {
      if (data.promiseId === 6) {
        // TODO test proxying data.endpoints
      }
    });

    alice.on('' + uProxy.Update.START_GIVING_TO_FRIEND, (data) => {
      expect(data).toEqual(BOB.INSTANCE_ID);
      done();
    });
  });
*/
});
