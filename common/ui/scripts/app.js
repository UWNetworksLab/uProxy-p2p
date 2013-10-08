/**
 * app.js
 *
 * This is the primary frontend script. It maintains in-memory state which is
 * continuously patched from the backend (uproxy.js) and provides hooks for the
 * UI to modify state and send messages.
 */
'use strict';

// TODO: client secret should not be public.
/**
var OAUTH_CONFIG = {
  'client_id': '814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com',
  'client_secret': 'JxrMEKHEk9ELTTSPgZ8IfZu-',
  'api_scope': 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/googletalk'
};
**/

angular.module('UProxyExtension', ['angular-lodash', 'dependencyInjector'])
  //.constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  //.constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
  // can remove once https://github.com/angular/angular.js/issues/2963 is fixed:
  .config(function ($provide) {
    $provide.decorator('$sniffer', ['$delegate', function ($sniffer) {
      $sniffer.csp = true;
      return $sniffer;
    }]);
  })
  // Run gets called every time the popup is openned. This initializes the main
  // extension UI and makes sure it is in sync with the app.
  .run([
    '$filter',
    '$http',
    '$rootScope',
    'freedom',               // Via dependencyInjector.
    'onFreedomStateChange',  // Via dependencyInjector.
    'model',                 // Via dependencyInjector.
    function($filter, $http, $rootScope,
             freedom, onFreedomStateChange, model) {

      if (undefined === model) {
        console.error('model not found in dependency injections.');
      }
      $rootScope.model = model;

      $rootScope.resetState = function () {
        localStorage.clear();
        freedom.emit('reset', null);
      };

      $rootScope.instanceOfClientId = function(clientId) {
        if (model.clientToInstance[clientId]) {
          return model.instances[model.clientToInstance[clientId]];
        } else {
          return null;
        }
      };

      $rootScope.instanceOfUserId = function(userId) {
        for (var i in model.instances) {
          if (model.instances[i].userId = userId) return i;
        }
        return null;
      };

      /**
       * Determine whether UProxy is connected to |network|.
       */
      $rootScope.isOnline = function(network) {
        window.tmp = model;
        return (model && model.identityStatus &&
                model.identityStatus[network] &&
                model.identityStatus[network].status == 'online');
      };
      $rootScope.login = function(network) {
        console.log('!!! login ' + network);
        freedom.emit('login', network);
      };
      $rootScope.logout = function(network) {
        console.log('!!! logout ' + network);
        freedom.emit('logout', network);
      };

      $rootScope.updateDescription = function() {
        if ($rootScope.oldDescription != model.me.description) {
          freedom.emit('update-description', model.me.description);
        }
        $rootScope.oldDescription = model.me.description;
      }

      // These work the same even if |client| is an instance - so long as it
      // contains the attribute |clientId|.

      // Request access through a friend.
      $rootScope.requestAccess = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'request-access');
      };
      $rootScope.cancelRequest = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'cancel-request');
      }
      $rootScope.acceptAccess = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'accept-access');
      };
      $rootScope.startAccess = function(instance) {
        // We don't need to tell them we'll start proxying, we can just try to
        // start. The SDP request will go through chat/identity network on its
        // own.
        freedom.emit('start-using-peer-as-proxy-server', instance.instanceId)
      };

      // Providing access for a friend:
      $rootScope.offerAccess = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'offer');
      };
      $rootScope.grantAccess = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'allow');
      };
      $rootScope.revokeAccess = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'deny');
      };
      $rootScope.denyAccess = $rootScope.revokeAccess;

      // |id| can be either a client id or a user id.
      $rootScope.instanceTrustChange = function (id, action) {
        freedom.emit('instance-trust-change', {
          instanceId: id, action: action });
      };

      $rootScope.changeOption = function (key, value) {
        freedom.emit('change-option', {key: key, value: value});
      }

      var clearedAndRetried = false;
      /**
      $rootScope.authGoog = function () {
        googleAuth.authorize(function () {
          var accessToken = googleAuth.getAccessToken();
          $http({method: 'GET', url: GOOG_PROFILE_URL, params: {'oauth_token': accessToken}}).then(
            function getProfileSuccessHandler(resp) {
              var email = resp.data.email;
              freedom.emit('goog-credentials', {email: email, token: accessToken});
              clearedAndRetried = false;
            },
            function getProfileFailureHandler(resp) {
              if (resp.status === 401) {
                console.debug('request for', GOOG_PROFILE_URL, 'yielded 401 response');
                if (clearedAndRetried) {
                  console.debug('already cleared access token and tried again');
                } else {
                  console.debug('clearing access token and trying again');
                  clearedAndRetried = true;
                  googleAuth.clearAccessToken();
                  //$rootScope.authGoog();
                }
              } else {
                console.debug('request for', GOOG_PROFILE_URL, 'failed:', resp);
              }
            });
        });
      }
      **/

      // TODO(): change the icon/text shown in the browser action, and maybe
      // add a butter-bar. This is important for when someone is proxying
      // through you. See:
      //   * chrome.browserAction.setBadgeText(...)
      //   * chrome.browserAction.setIcon
      //   * https://developer.chrome.com/extensions/desktop_notifications.html
      $rootScope.onStateChange = function (patch) {
        $rootScope.$apply(function () {
          // console.info('got state change:', patch);
          $rootScope.connectedToApp = true;
          // XXX jsonpatch can't mutate root object https://github.com/dharmafly/jsonpatch.js/issues/10
 /*
          if (_.isEmpty(model)) {  // Refresh state if local model is empty.
            if (patch[0].path === '') {
              angular.copy(patch[0].value, model);
            } else {
              console.info('model init patch not yet received, ignoring non init patch:', patch);
            }
          } else {*/

          // patches with an empty path don't seem to apply.
          if (patch[0].path === '') {
            angular.copy(patch[0].value, model);
          } else {
            jsonpatch.apply(model, patch);
          }
          //  patch = new jsonpatch.JSONPatch(patch, true);  // mutate = true
          //  patch.apply(model);
          // }
        });
      }

      // Can be called from nonUI threads (i.e. without a defined window
      // object.).
      $rootScope.startUI = function() {
        // call these in the Angular scope so that window is defined.
        $rootScope.$apply(function() {
          freedom.onConnected.removeListener($rootScope.startUI);
          onFreedomStateChange.addListener($rootScope.onStateChange);
          window.onunload = function() {
            onFreedomStateChange.removeListener($rootScope.onStateChange);
          };
          freedom.emit('open-popup');
          //$rootScope.authGoog();
          $rootScope.connectedToApp = true;
        });
      }

      $rootScope.connectedToApp = false;

      if(freedom.connected) {
        $rootScope.connectedToApp = true;
        $rootScope.startUI();
      } else {
        freedom.onConnected.addListener($rootScope.startUI);
        freedom.connect();
      }
    }  // run function
  ]);
