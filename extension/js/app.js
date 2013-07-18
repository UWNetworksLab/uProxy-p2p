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
    bkg.clearPopupListeners();

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
              bkg.freedom.emit('oauth-credentials', {email:email, token: accessToken});
              //sendToApp({email: email, token: accessToken});
            },
            function getProfileFailureHandler(resp) {
              console.error('request for', profileUrl, 'failed:', resp);
            });
        });
      } else {
        bkg.freedom.emit('oauth-credentials', {email:email, token: accessToken});
        //sendToApp({email: email, token: accessToken});
      }
    };


    //ryscheng
    $rootScope.uproxy = {};
    bkg.addPopupListener('state-change', function(patch) {
      console.log(patch);
      if (patch[0].path == '') {
        angular.copy(patch[0].value, $rootScope.uproxy);
      } else {
        patch = new jsonpatch.JSONPatch(patch, true);
        patch.apply($rootScope.uproxy);
      }
      $rootScope.$apply();
    });
    
    var input = document.getElementById('msg_input');
    input.onkeydown = function(evt) {
      if (evt.keyCode == 13) {
        var text = input.value;
        input.value = "";
        bkg.freedom.emit('send-message', text);
      }
    };

    
    bkg.freedom.emit('open-popup', '');
  }]);
