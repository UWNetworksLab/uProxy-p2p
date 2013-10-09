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
    'freedom',               // Via dependencyInjector - talks to backend.
    'onFreedomStateChange',  // Via dependencyInjector.
    'model',                 // Via dependencyInjector.
    function($filter, $http, $rootScope,
             appChannel, onFreedomStateChange, model) {
      if (undefined === model) {
        console.error('model not found in dependency injections.');
      }
      $rootScope.model = model;
      // $rootScope.VALID_NETWORKS = [
        // 'google',
        // 'facebook'
      // ];
      $rootScope.onAppData = onFreedomStateChange;

      $rootScope.resetState = function () {
        localStorage.clear();
        appChannel.emit('reset', null);
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
          if (model.instances[i].rosterInfo.userId == userId)
            return model.instances[i];
        }
        return null;
      };

      // Determine whether UProxy is connected to |network|.
      $rootScope.isOnline = function(network) {
        return (model && model.identityStatus &&
                model.identityStatus[network] &&
                'online' == model.identityStatus[network].status);
      };
      $rootScope.isOffline = function(network) {
        return (!model || !model.identityStatus ||
                !model.identityStatus[network] ||
                'offline' == model.identityStatus[network].status);
      };
      // Whether UProxy is logged in to *any* network.
      $rootScope.loggedIn = function() {
        return $rootScope.isOnline('google') || $rootScope.isOnline('facebook');
      };
      $rootScope.loggedOut = function() {
        return $rootScope.isOffline('google') && $rootScope.isOffline('facebook');
      };


      $rootScope.login = function(network) {
        console.log('!!! login ' + network);
        appChannel.emit('login', network);
      };
      $rootScope.logout = function(network) {
        console.log('!!! logout ' + network);
        appChannel.emit('logout', network);
      };

      $rootScope.updateDescription = function() {
        if ($rootScope.oldDescription != model.me.description) {
          appChannel.emit('update-description', model.me.description);
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
      $rootScope.acceptOffer = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'accept-offer');
      };
      $rootScope.declineOffer = function(instance) {
        $rootScope.instanceTrustChange(instance.instanceId, 'decline-offer');
      };
      $rootScope.startAccess = function(instance) {
        // We don't need to tell them we'll start proxying, we can just try to
        // start. The SDP request will go through chat/identity network on its
        // own.
        appChannel.emit('start-using-peer-as-proxy-server', instance.instanceId)
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
        appChannel.emit('instance-trust-change', {
          instanceId: id, action: action });
      };

      $rootScope.changeOption = function (key, value) {
        appChannel.emit('change-option', {key: key, value: value});
      }

      var clearedAndRetried = false;
      /**
      $rootScope.authGoog = function () {
        googleAuth.authorize(function () {
          var accessToken = googleAuth.getAccessToken();
          $http({method: 'GET', url: GOOG_PROFILE_URL, params: {'oauth_token': accessToken}}).then(
            function getProfileSuccessHandler(resp) {
              var email = resp.data.email;
              appChannel.emit('goog-credentials', {email: email, token: accessToken});
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
          $rootScope.connectedToApp = true;
          // XXX jsonpatch can't mutate root object https://github.com/dharmafly/jsonpatch.js/issues/10
          // patches with an empty path don't seem to apply.
          if (patch[0].path === '') {
            angular.copy(patch[0].value, model);
          } else {
            // console.log(jsonpatch);
            // console.log(patch);
            jsonpatch.apply_patch(model, patch);
          }
        });
      }

      // Can be called from nonUI threads (i.e. without a defined window
      // object.).
      $rootScope.startUI = function() {
        // call these in the Angular scope so that window is defined.
        $rootScope.$apply(function() {
          appChannel.onConnected.removeListener($rootScope.startUI);
          $rootScope.onAppData.addListener($rootScope.onStateChange);
          window.onunload = function() {
            $rootScope.onAppData.removeListener($rootScope.onStateChange);
          };
          appChannel.emit('open-popup');
          //$rootScope.authGoog();
          $rootScope.connectedToApp = true;
        });
      }
      $rootScope.reconnect = function() {
        console.log('Disconnected. Attempting to reconnect to app...');
        $rootScope.$apply(function() {
          $rootScope.connectedToApp = false;
        });
        appChannel.onDisconnected.removeListener($rootScope.reconnect);
        $rootScope.checkAppConnection();
      }

      $rootScope.connectedToApp = false;
      $rootScope.checkAppConnection = function() {
        if ($rootScope.connectedToApp) {
          return;  // Already connected.
        }
        // Check that the extension is connected.
        if(appChannel.connected) {
          $rootScope.connectedToApp = true;
          $rootScope.startUI();
        } else {
          console.log('connecting.');
          appChannel.onConnected.addListener($rootScope.startUI);
          appChannel.connect();
        }
        // Automatically attempt to reconnect when disconnected.
        appChannel.onDisconnected.addListener($rootScope.reconnect);
      }

      $rootScope.checkAppConnection();
    }  // run function
  ]);
