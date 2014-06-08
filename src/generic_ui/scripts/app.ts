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

var app = angular.module('UProxyExtension', ['angular-lodash', 'dependencyInjector'])
  // can remove once https://github.com/angular/angular.js/issues/2963 is fixed:
  .config(function ($provide :ng.auto.IProvideService) {
    $provide.decorator('$sniffer', ['$delegate', function ($sniffer) {
      $sniffer.csp = true;
      return $sniffer;
    }]);
  });

// Run gets called every time an extension module is opened. (e.g. opening the
// chrome extension popup).
app.run([
    '$rootScope',
    // via dependencyInjector:
    'ui',
    'core',
    'model',
    ($s :UI.RootScope,
     ui :uProxy.UIAPI,
     core :uProxy.CoreAPI,
     model :UI.modelForAngular) => {
      if (undefined === model) {
        console.error('model not found in dependency injections.');
      }
      $s.ui = ui;
      $s.core = core;
      $s.model = model;

      // Set the UI's refresher to be the angular $apply, which will
      // kick of a digest cycle from outside the angular context. (This is
      // necesasry anytime there is a non-user-initiated callback, like
      // receiving something over the wire).
      $s.ui['setRefreshHandler'](() => {
        $s.$apply(() => {
          console.log($s.ui['instance']);
          console.log('Refreshed the DOM!');
        });
      });

      $s.isOnline = (network) => {
        return (model.networks[network] && model.networks[network].online)
      };
      $s.isOffline = (network) => {
        return !$s.isOnline(network);
      };

      $s.resetState = function () {
        localStorage.clear();
        core.reset();
      };

      $s.prettyNetworkName = (networkId) => {
        switch (networkId) {
          case 'google': return 'Google';
          case 'facebook': return 'FB';
          case 'xmpp': return 'XMPP';
          case 'websocket': return 'websocket';
          default:
            console.warn("No prettification for network: " + JSON.stringify(networkId));
        }
        return networkId;
      };

      // TODO(): change the icon/text shown in the browser action, and maybe
      // add a butter-bar. This is important for when someone is proxying
      // through you. See:
      //   * chrome.browserAction.setBadgeText(...)
      //   * chrome.browserAction.setIcon
      //   * https://developer.chrome.com/extensions/desktop_notifications.html
    }  // run function
  ]);

// TODO: Put these directives in their own dedicated files.

/*
 * The uProxy Consent directive handles all consent commands from the UI to
 * the Core, which handles passing consent bits over the wire.
 */
app.directive('uproxyConsent', () => {
    // TODO: Specify the scoping of the 'current user' in a better way.
    var link = ($s, element, attrs) => {
      $s.ProxyState = Consent.ProxyState;
      $s.ClientState = Consent.ClientState;
      var _modifyConsent = (action:Consent.UserAction) => {
        console.log($s.currentProxyState(), $s.currentClientState());
        $s.core.modifyConsent(<uProxy.ConsentCommand>{
          path: {
            network:    $s.ui['network'],
            userId:     $s.ui.user.userId,
            instanceId: $s.ui.instance.instanceId
          },
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
  });

/**
 * The uProxy Instance Action directive generates HTML with a button that
 * links to a valid instance action.
 *
 * Usage: <uproxy-instance-action text='$stuff_for_this_button
 *            action='$Consent.UserAction'>
 *        </uproxy-instance-action>
 *
 * For $Consent.UserAction, refer to the enum in 'generic_core/consent.ts'.
 */
app.directive('uproxyConsentAction', () => {
    var link = ($s, element, attrs) => {
      $s.text = attrs['text'];
      // Function which sends a consent command to the Core based on the Enum
      // string specified in the HTML.
      $s.action = () => {
        var actionEnumStr = <string>attrs['action'];
        var action :Consent.UserAction = Consent.UserAction[actionEnumStr];
        $s.core.modifyConsent(<uProxy.ConsentCommand>{
          // TODO: Maybe put the code which generates the :InstancePath in the
          // ui.ts or a future UI.Instance class.
          path: {
            network:    $s.ui['network'],
            userId:     $s.ui.user.userId,
            instanceId: $s.ui.instance.instanceId
          },
          action:     action
        });
      };
      $s.hide = attrs['hide'];
      $s.disabled = attrs['disabled'];
      // TODO: Disable action buttons immediately after clicking, until state
      // updates completely to prevent duplicate clicks.
    };
    return {
      restrict: 'E',
      templateUrl: 'templates/consent-action.html',
      link: link,
      scope: true
    }
  });

/**
 * uProxy Proxy Gadget directive contains the start and stop hooks for the
 * actual proxying, hooked up to buttons.
 */
app.directive('uproxyProxyGadget', () => {
    var link = ($s, element, attrs) => {
      $s.start = $s.ui.startProxying;
      $s.stop = $s.ui.stopProxyingUserInitiated
    };
    return {
      restrict: 'E',
      templateUrl: 'templates/proxy-gadget.html',
      link: link
    };
  });

/**
 * uProxy Client Gadget contains bandwidth / current usage indicators
 * for when the remote client is current proxying through you.
 * TODO: Implement.
 */
app.directive('uproxyClientGadget', () => {
  var link = ($s, element, attrs) => {};
  return {
    restrict: 'E',
    templateUrl: 'templates/client-gadget.html',
    link: link
  }
});
