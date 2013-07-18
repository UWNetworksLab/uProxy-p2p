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

    var googleAuth = new OAuth2('google', OAUTH_CONFIG);
    var profileUrl = 'https://www.googleapis.com/oauth2/v1/userinfo';
    var accessToken, email;
    var bkg = chrome.extension.getBackgroundPage();

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
              bkg.freedom.emit('oauth-credentials', {email:email, token, accessToken});
              //sendToApp({email: email, token: accessToken});
            },
            function getProfileFailureHandler(resp) {
              console.error('request for', profileUrl, 'failed:', resp);
            });
        });
      } else {
        bkg.freedom.emit('oauth-credentials', {email:email, token, accessToken});
        //sendToApp({email: email, token: accessToken});
      }
    };
  }]);
