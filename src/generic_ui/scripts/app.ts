/**
 * app.js
 *
 * This is the primary frontend script. It maintains in-memory state which is
 * continuously patched from the backend (uproxy.js) and provides hooks for the
 * UI to modify state and send messages.
 *
 * It does not directly connect to the App - that would be redundant as
 * everytime the popup was clicked, everything reloads, while it's
 * straightforward to let the background page connect to the App.
 */

/// <reference path='../../interfaces/lib/angular.d.ts'/>
/// <reference path='../../interfaces/instance.d.ts'/>
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../uproxy.ts'/>

angular.module('UProxyExtension', ['angular-lodash', 'dependencyInjector'])
  //.constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  //.constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
  // can remove once https://github.com/angular/angular.js/issues/2963 is fixed:
  .config(function ($provide :ng.auto.IProvideService) {
    $provide.decorator('$sniffer', ['$delegate', function ($sniffer) {
      $sniffer.csp = true;
      return $sniffer;
    }]);
  })
  // Run gets called every time an extension module is opened.
  .run([
    '$rootScope',
    // via dependencyInjector:
    'ui',
    'core',
    'onStateChange',
    'model',
    function($rootScope :UI.RootScope,
             ui :uProxy.UIAPI,
             core :uProxy.CoreAPI,
             // TODO: Change type to something cross-browser compatible
             onStateChange :chrome.Event,
             model :UI.modelForAngular) {
      if (undefined === model) {
        console.error('model not found in dependency injections.');
      }
      $rootScope.ui = ui;
      $rootScope.core = core;
      $rootScope.model = model;

      $rootScope.isOnline = function(network) {
        return (model.networks[network] && model.networks[network].online)
      };
      $rootScope.isOffline = function(network) {
        return !$rootScope.isOnline(network);
      };

      // Determine whether UProxy is connected to some network.
      $rootScope.loggedIn = function() {
        for (var networkId in model.networks) {
          if (model.networks[networkId].online) {
            return true;
          }
        }
        return false;
      };

      // This is *NOT* the inverse of loggedIn, because it is possible to be
      // "logging in"
      // Not Logged-out if state is not logged out for any network.
      $rootScope.loggedOut = function() {
        for (var networkId in model.networks) {
          if (!model.networks[networkId].online) {
            return false;
          }
        }
        return true;
      };

      $rootScope.resetState = function () {
        localStorage.clear();
        core.reset();
      };

      // Takes in an entry from the roster table.
      $rootScope.instanceOfContact = function(contact) {
        for (var clientId in contact.clients) {
          var instanceId = model.clientToInstance[clientId];
          if (instanceId) {
            return model.instances[instanceId];
          }
        }
        // Now check user-id matching because if the client is not online, they
        // will not have a client id.
        for (var instanceId in model.instances) {
          if (model.instances[instanceId].rosterInfo.userId == contact.userId)
            return model.instances[instanceId];
        }
        return null;
      };

      $rootScope.prettyNetworkName = function(networkId) {
        switch (networkId) {
          case 'google': return 'G+';
          case 'facebook': return 'FB';
          case 'xmpp': return 'XMPP';
          case 'websocket': return 'websocket';
          default:
            console.warn("No prettification for network: " + JSON.stringify(networkId));
        }
        return networkId;
      };

      // TODO: remove since there will be multiple instances for a userId
      $rootScope.instanceOfUserId = function(userId) {
        // First check active clients
        // Do this first, because some users' IDs don't matchs their instance
        // id that they sent over.
        for (var userId in model.roster) {
          var instance = $rootScope.instanceOfContact(model.roster[userId]);
          if (instance) return instance;
        }
        // Now check user-id matching because if the client is not online, they
        // will not have a client id.
        for (var instanceId in model.instances) {
          if (model.instances[instanceId].rosterInfo.userId == userId)
            return model.instances[instanceId];
        }
        return null;
      };

      // TODO(): change the icon/text shown in the browser action, and maybe
      // add a butter-bar. This is important for when someone is proxying
      // through you. See:
      //   * chrome.browserAction.setBadgeText(...)
      //   * chrome.browserAction.setIcon
      //   * https://developer.chrome.com/extensions/desktop_notifications.html
      $rootScope.updateDOM = function() {
        $rootScope.$apply(function () {
          // Also update pointers locally ?
          // $rootScope.instances = model.instances;
        });
      };

      // State change event handler is browser specific, or it might not exist
      // at all.
      if (onStateChange) {
        onStateChange.addListener($rootScope.updateDOM);
      }
    }  // run function
  ])
  // The consent directive handles all consent activity.
  // .directive('uproxyConsent', () => {
  // });
  // This controller deals with modification of consent bits and the actual
  // starting/stopping of proxying for one particular instance.
  .controller('InstanceActions', ['$scope', 'ui', function($s, ui) {
    // TODO: below is ALL obsolete once the CoreConnector consent bits work.

    // Helper which changes consent bits.
    // These work the same even if |client| is an instance - so long as it
    // contains the attribute |clientId|.
    // |id| can be either a client id or a user id.
    /*
    var _modifyConsent = function (id, action) {
      setTimeout(function() {
        ui.modifyConsent(id, action);
      }, 0); // TODO: why is this a timeout?
    };
    var _modifyProxyConsent = function(instance, action) {
      _modifyConsent(instance.instanceId, action);
      ui.pendingProxyTrustChange = true;
    }
    var _modifyClientConsent = function(instance, action) {
      _modifyConsent(instance.instanceId, action);
      ui.pendingClientTrustChange = true;
    }
    */
    // Consent to access through a friend.
    /*
    $s.requestAccess = function(instance) {
      _modifyProxyConsent(instance, 'request-access');
    };
    $s.cancelRequest = function(instance) {
      _modifyProxyConsent(instance, 'cancel-request');
    }
    $s.acceptOffer = function(instance) {
      _modifyProxyConsent(instance, 'accept-offer');
    };
    $s.declineOffer = function(instance) {
      _modifyProxyConsent(instance, 'decline-offer');
    };

    // Consent to provide access for a friend:
    $s.offerAccess = function(instance) {
      _modifyClientConsent(instance, 'offer');
    };
    $s.grantAccess = function(instance) {
      _modifyClientConsent(instance, 'allow');
    };
    $s.revokeAccess = function(instance) {
      _modifyClientConsent(instance, 'deny');
    };
    $s.denyAccess = $s.revokeAccess;

    $s.startAccess = function(instance) {
      // We don't need to tell them we'll start proxying, we can just try to
      // start. The SDP request will go through chat/identity network on its
      // own.
      ui.startProxying(instance);
    };

    $s.stopAccess = function(instance) {
      ui.stopProxying();
    };
    */
  }]);
