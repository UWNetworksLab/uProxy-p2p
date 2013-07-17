'use strict';

angular.module('UProxyExt', [
  ])
  .constant('OAUTH_CONFIG', {
    client_id: '814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com',
    client_secret: 'JxrMEKHEk9ELTTSPgZ8IfZu-',
    api_scope: 'https://www.googleapis.com/auth/userinfo.email '+
               'https://www.googleapis.com/auth/googletalk'
  })
  .controller('MainCtrl', ['$rootScope', '$http', 'OAUTH_CONFIG', function ($rootScope, $http, OAUTH_CONFIG) {
    // XXX https://github.com/UWNetworksLab/UProxy/issues/7
    var appId = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';

    function sendToApp(data) {
      // XXX https://github.com/skivvies/UProxy/issues/3
      chrome.runtime.sendMessage(appId, data,
        function (response) {
          console.log('Got response:', response);
        }
      );
    }

    var googleAuth = new OAuth2('google', OAUTH_CONFIG);
    var profileUrl = 'https://www.googleapis.com/oauth2/v1/userinfo';
    var accessToken, email;

    $rootScope.sendCredentials = function () {
      if (!accessToken || !email) {
        googleAuth.authorize(function() {
          accessToken = googleAuth.getAccessToken();
          $http({
            method: 'GET',
            url: profileUrl,
            params: {oauth_token: accessToken}
          }).then(
            function getProfileSuccessHandler(resp) {
              var email = resp.data.email;
              sendToApp({email: email, token: accessToken});
            },
            function getProfileFailureHandler(resp) {
              console.error('request for', profileUrl, 'failed:', resp);
            });
        });
      } else {
        sendToApp({email: email, token: accessToken});
      }
    };
  }]);
