/**
 * app.js
 *
 * This is the primary frontend script. It maintains in-memory state which is
 * continuously patched from the backend (uproxy.js) and provides hooks for the
 * UI to modify state and send messages.
 *
 * It does not directly connect to the App - that would be redundant as
 * everytime the popup was clicked, things would occur.
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
  // Run gets called every time an extension module is opened.
  .run([
    '$filter',
    '$http',
    '$rootScope',
    'ui',                       // via dependencyInjector.
    'appChannel',               // via dependencyInjector.
    'onStateChange',
    'model',
    'roster',
    function($filter, $http, $rootScope, ui,
             appChannel, onStateChange,
             model, roster) {
      if (undefined === model) {
        console.error('model not found in dependency injections.');
      }
      console.log(model);
      $rootScope.ui = ui;
      $rootScope.model = model;
      $rootScope.notifications = 0;

      // Remember the state change hook.
      $rootScope.update = onStateChange;

      $rootScope.resetState = function () {
        localStorage.clear();
        appChannel.emit('reset', null);
      };

      // Takes in an entry from the roster table.
      $rootScope.instanceOfContact = function(contact) {
        for (var clientId in contact.clients) {
          if(clientId in model.clientToInstance)
            return model.instances[model.clientToInstance[clientId]];
        }
        return null;
      };

      $rootScope.instanceOfClientId = function(clientId) {
        if (model.clientToInstance[clientId]) {
          return model.instances[model.clientToInstance[clientId]];
        } else {
          return null;
        }
      };

/*
      // Broken by hangouts: user-ids sent to us don't match those in roster.
      $rootScope.instanceOfUserId = function(userId) {
        for (var i in model.instances) {
          if (model.instances[i].rosterInfo.userId == userId)
            return model.instances[i];
        }
        return null;
      };
*/
      $rootScope.instanceOfUserId = function(userId) {
        for (var userId in model.roster) {
          var instance = $rootScope.instanceOfContact(model.roster[userId]);
          if (instance) return instance;
        }
        return null;
      };

      $rootScope.login = function(network) {
        console.log('!!! login ' + network);
        appChannel.emit('login', network);
      };
      $rootScope.logout = function(network) {
        console.log('!!! logout ' + network);
        appChannel.emit('logout', network);
        ui.proxy = null;
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
        appChannel.emit('start-using-peer-as-proxy-server', instance.instanceId);
        ui.proxy = instance;
        ui.setProxying(true);
      };
      $rootScope.stopAccess = function(instance) {
        instance = instance || ui.instance;
        appChannel.emit('stop-proxying', instance.instanceId);
        ui.setProxying(false);
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
        console.log('instance trust change ' + action + ', ' + id);
        appChannel.emit('instance-trust-change', {
          instanceId: id, action: action });
      };

      // Notifications occur on the user level. The message sent to the app side
      // will also remove the notification flag from instances.
      $rootScope.notificationSeen = function (user) {
        if (!user.hasNotification) {
          return;  // Ignore if user has no notification.
        }
        appChannel.emit('notification-seen', user.userId);
        user.hasNotification = false;
        // $rootScope.notifications--;
        // if ($rootScope.notifications == 0) {
          // $rootScope.notifications = '';
        // }
        ui.decNotifications();
        // icon.label('' + $rootScope.notifications);
      }

      $rootScope.changeOption = function (key, value) {
        appChannel.emit('change-option', {key: key, value: value});
      }

      var clearedAndRetried = false;

      // TODO(): change the icon/text shown in the browser action, and maybe
      // add a butter-bar. This is important for when someone is proxying
      // through you. See:
      //   * chrome.browserAction.setBadgeText(...)
      //   * chrome.browserAction.setIcon
      //   * https://developer.chrome.com/extensions/desktop_notifications.html
      var updateDOM = function(patch) {
        $rootScope.$apply(function () {
          $rootScope.connectedToApp = true;
          // Also update pointers locally.
          // $rootScope.instances = model.instances;
        });
        // console.log($rootScope.model);
      };
      onStateChange.addListener(updateDOM);
      $rootScope.updateDOM = updateDOM;
    }  // run function
  ]);
