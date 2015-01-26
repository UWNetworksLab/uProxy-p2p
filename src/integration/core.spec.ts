/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

var REDIRECT_URL = 'http://localhost';
var CLIENT_ID =
    '746567772449-mv4h0e34orsf6t6kkbbht22t9otijip0.apps.googleusercontent.com';
var CLIENT_SECRET = 'M-EGTuFRaWLS5q_hygpJZMBu';

var ALICE = {
  EMAIL: 'alicefreedomxmpp@gmail.com',
  NAME: 'Alice Freedom',
  REFRESH_TOKEN:
      '1/p8X36mT_Ugq4wJfC8emXFnpIMn9Ojj1zxNpmjdVq3js',
  ANONYMIZED_ID: null  // Needs to be detected through an onUserProfile event.
};
var BOB = {
  EMAIL: 'bobfreedomxmpp@gmail.com',
  NAME: 'Bob Freedom',
  REFRESH_TOKEN:
      '1/RT6ACx5aMr5Mcfa8P-uIo4dHBillQoJmEukALkbJWNw',
  ANONYMIZED_ID: null  // Needs to be detected through an onUserProfile event.
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
  var aliceUproxy;
  var bobUproxy;
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
      aliceUproxy = interface();
    });
    var bobPromise = freedom(uProxyFreedom,
        {oauth: [BobOAuthView], debug: 'log'})
        .then(function(interface) {
      bobUproxy = interface();
    });
    Promise.all([alicePromise, bobPromise]).then(function() {
      done();
    });
  });

  it('logs in', (done) => {
    done();
  });

  it('grants permissions', (done) => {
    done();
  });

  it('start proxying', (done) => {
    done();
  });

  it('stop and start proxying again', (done) => {
    done();
  });

  it('log out', (done) => {
    done();
  });

  it('change permissions', (done) => {
    done();
  });

  it('log in check permissions', (done) => {
    done();
  });

  it('try proxying again', (done) => {
    done();
  });
});
