'use strict';

// TODO: client secret should not be public.
var OAUTH_CONFIG = {
  'client_id': '814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com',
  'client_secret': 'JxrMEKHEk9ELTTSPgZ8IfZu-',
  'api_scope': 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/googletalk'
};

angular.module('UProxyChromeExtension')
  .constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  .constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
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

      // XXX move to run block once https://github.com/angular/angular.js/issues/2963 is fixed
      $rootScope.$watch('model.options.mode', function (mode) {
        if (!mode) return;
        $rootScope.inGiveMode = mode === 'give';
        $rootScope.inGetMode = mode === 'get';
      });

      $rootScope.sendCredentials = function () {
        if (!model.accessToken || !model.email) {
          googleAuth.authorize(function () {
            var accessToken = googleAuth.getAccessToken();
            $http({method: 'GET', url: GOOG_PROFILE_URL, params: {'oauth_token': accessToken}}).then(
              function getProfileSuccessHandler(resp) {
                var email = resp.data.email;
                freedom.emit('gtalk-credentials', {email: email, token: accessToken});
              },
              function getProfileFailureHandler(resp) {
                console.error('request for', GOOG_PROFILE_URL, 'failed:', resp);
              });
          });
        } else {
          freedom.emit('gtalk-credentials', {email: model.email, token: model.accessToken});
        }
      };
    }
  ])
  .controller('DebugCtrl', ['$scope', 'freedom', function($scope, freedom) {
    $scope.sendMsg = function () {
      if ($scope.chatbuddy && $scope.chatbuddy.devices) {
        var devices = $scope.chatbuddy.devices;
        for (var i = 0; i < devices.length; i++) {
          if (devices[i].status == 'online') {
            freedom.emit('send-message', {to: devices[i].deviceId, message: $scope.msg})
            $scope.msg = '';
            return;
          }
        }
      }
      freedom.emit('echo', "No available recipient: " + $scope.msg);
      $scope.msg = '';
    };
  }]);
