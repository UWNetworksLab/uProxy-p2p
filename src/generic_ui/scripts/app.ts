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
      // 'E' is an angular directive attribute.
      // See: https://docs.angularjs.org/guide/directive
      restrict: 'E',
      templateUrl: 'templates/consent.html',
      link: link
    };
  })

  /**
   * The uProxy Instance Action directive generates HTML with a button that
   * links to a valid instance action.
   *
   * Usage: <uproxy-instance-action text='$stuff_for_this_button
   *            action='$function_to_use'>
   *        </uproxy-instance-action>
   */
  .directive('uproxyConsentAction', () => {
    var link = ($s, element, attrs) => {
      $s.text = attrs['text'];
      // Function which sends a consent command to the Core based on the Enum
      // string specified in the HTML.
      $s.action = () => {
        var actionEnumStr = <string>attrs['action'];
        var action :Consent.UserAction = Consent.UserAction[actionEnumStr];
        console.log(actionEnumStr, action);
        console.log($s.currentProxyState(), $s.currentClientState());
        $s.core.modifyConsent(<uProxy.ConsentCommand>{
          network:    $s.ui['network'],
          userId:     $s.ui.user.userId,
          instanceId: $s.ui.instance.instanceId,
          action:     action
        });
      };
      $s.hide = attrs['hide'];
      $s.disabled = attrs['disabled'];
    };
    return {
      restrict: 'E',
      templateUrl: 'templates/instance-action.html',
      link: link
    }
  })

  /**
   * uProxy Proxy Gadget directive contains the start and stop hooks for the
   * actual proxying, hooked up to buttons.
   */
  .directive('uproxyProxyGadget', () => {
    var link = ($s, element, attrs) => {
      // TODO: Replace these calls with the proxy service.
      $s.start = () => {
        console.log('Starting to proxy...');
        $s.core.start($s.ui.instance.instanceId);
      };
      $s.stop = () => {
        console.log('Stopping usage of proxy...');
        $s.core.stop($s.ui.instance.instanceId);
      };
    };
    return {
      restrict: 'E',
      templateUrl: 'templates/proxy-gadget.html',
      link: link
    };
  })

  /**
   * uProxy Client Gadget contains bandwidth / current usage indicators
   * for when the remote client is current proxying through you.
   * TODO: Implement.
   */
  .directive('uproxyClientGadget', () => {
    var link = ($s, element, attrs) => {};
    return {
      restrict: 'E',
      templateUrl: 'templates/client-gadget.html',
      link: link
    }
  });
