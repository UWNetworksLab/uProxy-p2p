// The angular module and defintions for state associated with the underlying
// app. This code defines
'use strict';

// TODO: client secret should not be public.
/**
var OAUTH_CONFIG = {
  'client_id': '814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com',
  'client_secret': 'JxrMEKHEk9ELTTSPgZ8IfZu-',
  'api_scope': 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/googletalk'
};
**/

var bg = chrome.extension.getBackgroundPage();

angular.module('UProxyChromeExtension', ['angular-lodash'])
  //.constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  //.constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
  // can remove once https://github.com/angular/angular.js/issues/2963 is fixed:
  .config(function ($provide) {
    $provide.decorator('$sniffer', ['$delegate', function ($sniffer) {
      $sniffer.csp = true;
      return $sniffer;
    }]);
  }) //
  .filter('chromei18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .filter('messageable', function () {
    return function (contact) {
      return _.any(contact.clients, {status: 'messageable'});
    };
  })
  .filter('onlineNotMessageable', ['$filter', function ($filter) {
    var messageable = $filter('messageable');
    return function (contact) {
      return _.any(contact.clients, {status: 'online'}) && !messageable(contact);
    };
  }])
  .filter('offline', function () {
    return function (contact) {
      return _.all(contact.clients, {status: 'offline'});
    };
  })
  .constant('bg', chrome.extension.getBackgroundPage())
  .constant('chrome', chrome)
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  // application state. determined by backend (packaged app)
  .constant('model', {})
  // Run gets called every time the popup is openned. This initialises the main
  // extension UI and makes sure it is in sync with the app.
  .run([
    '$filter',
    '$http',
    '$rootScope',
    'bg',
    'chrome',
    'freedom',
    'model',
    function($filter, $http, $rootScope, bg, chrome, freedom, model) {
      var filter = $filter('filter'),
          messageable = $filter('messageable'),
          onlineNotMessageable = $filter('onlineNotMessageable');

      $rootScope.extensionID = chrome.runtime.id;
      $rootScope.model = model;

      $rootScope.$watch('model.roster', function (roster) {
        if (!roster) return;
        $rootScope.contactsOnlineNotMessageable = filter(roster, onlineNotMessageable);
        $rootScope.contactsMessageable = filter(roster, messageable);
      }, true);

      $rootScope.$watch('model.canGetFrom', updateCanGetFrom, true);
      $rootScope.$watch('contactsMessageable', updateCanGetFrom, true);

      function updateCanGetFrom() {
        $rootScope.canGetFrom = {};
        $rootScope.cannotGetFrom = {};
        _.each($rootScope.contactsMessageable, function (contact) {
          if (contact.userId in model.canGetFrom) {
            $rootScope.canGetFrom[contact.userId] = contact;
          } else {
            $rootScope.cannotGetFrom[contact.userId] = contact;
          }
        });
      }

      $rootScope.resetState = function (msgName, data) {
        localStorage.clear();
        freedom.emit('reset', null);
      }

      $rootScope.sendMessage = function (contact, msg) {
        // XXX freedom.emit('send-message', {to: contact.userId, msg})
        //     gets intercepted by non-freedom clients and is not received by uproxy clients
        _(contact.clients).filter({status: 'messageable'}).each(
            function (client) {
          freedom.emit('send-message', {
            to: client.clientId,
            toUserId: contact.userId,
            message: msg});
        });
      }

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

      // TODO(): change the icon/text shown in the broswer action, and maybe
      // add a butter-bar. This is important for when someone is proxying
      // through you. See:
      //   * chrome.browserAction.setBadgeText(...)
      //   * chrome.browserAction.setIcon
      //   * https://developer.chrome.com/extensions/desktop_notifications.html
      $rootScope.onStateChange = function (patch) {
        $rootScope.$apply(function () {
          console.info('got state change:', patch);
          $rootScope.connectedToApp = true;
          // XXX jsonpatch can't mutate root object https://github.com/dharmafly/jsonpatch.js/issues/10
          if (patch[0].path === '') {
            angular.copy(patch[0].value, model);
          } else {
            if (_.isEmpty(model)) {
              console.info('model init patch not yet received, ignoring non init patch:', patch);
            } else {
              patch = new jsonpatch.JSONPatch(patch, true); // mutate = true
              patch.apply(model);
            }
          }
        });
      }

      // Can be called from nonUI threads (i.e. without a defined window
      // object.).
      $rootScope.startUI = function() {
        // call these in the Angular scope so that window is defined.
        $rootScope.$apply(function() {
          freedom.onConnected.removeListener($rootScope.startUI);
          bg.onFreedomStateChange.addListener($rootScope.onStateChange);
          window.onunload = function() {
            bg.onFreedomStateChange.removeListener($rootScope.onStateChange);
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
