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
        $rootScope.$apply(() => {});
      };

      // State change event handler is browser specific, or it might not exist
      // at all.
      if (onStateChange) {
        onStateChange.addListener($rootScope.updateDOM);
      }
    }  // run function
  ])

  /*
   * The uProxy Consent directive handles all consent commands from the UI to
   * the Core, which handles passing consent bits over the wire.
   */
  .directive('uproxyConsent', () => {
    // TODO: Specify the scoping of the 'current user' in a better way.
    var link = ($s, element, attrs) => {
      $s.ProxyState = Consent.ProxyState;
      $s.ClientState = Consent.ClientState;
      var _modifyConsent = (action:Consent.UserAction) => {
        console.log($s.currentProxyState(), $s.currentClientState());
        $s.core.modifyConsent(<uProxy.ConsentCommand>{
          network:    $s.ui['network'],
          userId:     $s.ui.user.userId,
          instanceId: $s.ui.instance.instanceId,
          action:     action
        });
      }
      // Consent to access through a friend:
      $s.requestAccess = () => {
        _modifyConsent(Consent.UserAction.REQUEST);
      };
      $s.cancelRequest = () => {
        _modifyConsent(Consent.UserAction.CANCEL_REQUEST);
      };
      $s.acceptOffer = () => {
        _modifyConsent(Consent.UserAction.ACCEPT_OFFER);
      };
      $s.ignoreOffer = () => {
        _modifyConsent(Consent.UserAction.IGNORE_OFFER);
      };
      // Consent to provide access for a friend:
      $s.offerAccess = () => {
        _modifyConsent(Consent.UserAction.OFFER);
      };
      $s.cancelOffer = () => {
        _modifyConsent(Consent.UserAction.CANCEL_OFFER);
      };
      $s.allowRequest = () => {
        _modifyConsent(Consent.UserAction.ALLOW_REQUEST);
      };
      $s.ignoreRequest = () => {
        _modifyConsent(Consent.UserAction.IGNORE_REQUEST);
      };
      // Current status indications need to return the enum strings.
      $s.currentProxyState = () => {
        if (!$s.ui.instance) {
          return 'NONE';
        }
        return '' + $s.ProxyState[$s.ui.instance.consent.asProxy];
      }
      $s.currentClientState = () => {
        if (!$s.ui.instance) {
          return 'NONE';
        }
        return '' + $s.ClientState[$s.ui.instance.consent.asClient];
      }
    };
    return {
      restrict: 'E',
      templateUrl: 'consent.html',
      link: link
    };
  });
  // This controller deals with modification of consent bits and the actual
  // starting/stopping of proxying for one particular instance.
  // TODO: Create a proxy/client angular directive.
  /*
  .controller('InstanceActions', ['$scope', 'ui', function($s, ui) {
    $s.startAccess = function(instance) {
      // We don't need to tell them we'll start proxying, we can just try to
      // start. The SDP request will go through chat/identity network on its
      // own.
      ui.startProxying(instance);
    };

    $s.stopAccess = function(instance) {
      ui.stopProxying();
    };
  }]);
  */
