'use strict';

/*jshint -W106 */

var OAUTH_CONFIG = {
  client_id: '814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com',
  client_secret: 'JxrMEKHEk9ELTTSPgZ8IfZu-',
  api_scope: 'https://www.googleapis.com/auth/userinfo.email '+
             'https://www.googleapis.com/auth/googletalk'
};

angular.module('UProxyChromeExtension', [])
  .filter('chromei18n', function () {
    return function (key) {
      return chrome.i18n.getMessage(key);
    };
  })
  .constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
  .constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  .constant('bg', chrome.extension.getBackgroundPage())
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('model', {}) // application state. determined by backend (packaged app)
  .controller('MainCtrl',
      ['$rootScope', '$http', 'GOOG_PROFILE_URL', 'googleAuth', 'freedom', 'model', 'bg',
      function ($rootScope, $http, GOOG_PROFILE_URL, googleAuth, freedom, model, bg) {

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

    bg.clearPopupListeners();
    freedom.emit('open-popup', '');

    bg.addPopupListener('state-change', function (patch) {
      console.log('got state change:', patch);
      $rootScope.$apply(function () {
        // XXX jsonpatch can't mutate root object https://github.com/dharmafly/jsonpatch.js/issues/10
        if (patch[0].path === '') {
          angular.copy(patch[0].value, model);
        } else {
          try {
            patch = new jsonpatch.JSONPatch(patch, true); // mutate = true
            patch.apply(model);
          } catch (e) {
            console.error('Error applying patch:', patch);
            if (!(e instanceof jsonpatch.PatchApplyError || e instanceof jsonpatch.InvalidPatch)) {
              throw e;
            }
          }
        }
      });
    });
  }]);
