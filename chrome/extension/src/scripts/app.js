'use strict';

// TODO: client secret should not be public.
var OAUTH_CONFIG = {
  'client_id': '814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com',
  'client_secret': 'JxrMEKHEk9ELTTSPgZ8IfZu-',
  'api_scope': 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/googletalk'
};

angular.module('UProxyChromeExtension', ['angular-lodash'])
  .constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  .constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
  // can remove once https://github.com/angular/angular.js/issues/2963 is fixed:
  .config(function ($provide) {
    $provide.decorator('$sniffer', ['$delegate', function ($sniffer) {
      $sniffer.csp = true;
      return $sniffer;
    }]);
  }) //
  .filter('chromei18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('bg', chrome.extension.getBackgroundPage())
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('model', {}) // application state. determined by backend (packaged app)
  .run([
    '$http',
    '$rootScope',
    'GOOG_PROFILE_URL',
    'bg',
    'freedom',
    'googleAuth',
    'model',
    function($http, $rootScope, GOOG_PROFILE_URL, bg, freedom, googleAuth, model) {
      $rootScope.model = model;

      $rootScope.changeOption = function (key, value) {
        freedom.emit('changeOption', {key: key, value: value});
      };

      $rootScope.authGoog = function () {
        googleAuth.authorize(function () {
          var accessToken = googleAuth.getAccessToken();
          $http({method: 'GET', url: GOOG_PROFILE_URL, params: {'oauth_token': accessToken}}).then(
            function getProfileSuccessHandler(resp) {
              var email = resp.data.email;
              freedom.emit('goog-credentials', {email: email, token: accessToken});
            },
            function getProfileFailureHandler(resp) {
              console.error('request for', GOOG_PROFILE_URL, 'failed:', resp);
            });
        });
      };

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
    }
  ]);
