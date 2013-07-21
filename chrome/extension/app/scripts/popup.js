'use strict';

var OAUTH_CONFIG = {
  "client_id": "814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com",
  "client_secret": "JxrMEKHEk9ELTTSPgZ8IfZu-",
  "api_scope": "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/googletalk"
};

angular.module('UProxyChromeExtension', [])
  .filter('chromei18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
  .constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  .constant('bg', chrome.extension.getBackgroundPage())
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('model', {}) // application state. determined by backend (packaged app)
  .run(['$rootScope', 'bg', 'freedom', 'model', function($rootScope, bg, freedom, model) {
    bg.clearPopupListeners();
    freedom.emit('open-popup', '');

    var JSONPatch = jsonpatch.JSONPatch;
    bg.addPopupListener('state-change', function (patch) {
      console.debug('got state change:', patch);
      $rootScope.$apply(function () {
        // XXX jsonpatch can't mutate root object https://github.com/dharmafly/jsonpatch.js/issues/10
        if (patch[0].path === '') {
          angular.copy(patch[0].value, model);
        } else {
          patch = new JSONPatch(patch, true); // mutate = true
          patch.apply(model);
        }
      });
    });
  }])
  .controller('MainCtrl', [
    '$http',
    '$rootScope',
    'GOOG_PROFILE_URL',
    'bg',
    'freedom',
    'googleAuth',
    'model',
    function ($http, $rootScope, GOOG_PROFILE_URL, bg, freedom, googleAuth, model) {
      $rootScope.model = model;

      $rootScope.sendCredentials = function () {
        if (!model.accessToken || !model.email) {
          googleAuth.authorize(function () {
            var accessToken = googleAuth.getAccessToken();
            $http({method: 'GET', url: GOOG_PROFILE_URL, params: {oauth_token: accessToken}}).then(
              function getProfileSuccessHandler(resp) {
                var email = resp.data.email;
                freedom.emit('oauth-credentials', {email: email, token: accessToken});
              },
              function getProfileFailureHandler(resp) {
                console.error('request for', GOOG_PROFILE_URL, 'failed:', resp);
              });
          });
        } else {
          freedom.emit('oauth-credentials', {email: model.email, token: model.accessToken});
        }
      };
    }
  ]);
