'use strict';

// TODO: client secret should not be public.
var OAUTH_CONFIG = {
  'client_id': '814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com',
  'client_secret': 'JxrMEKHEk9ELTTSPgZ8IfZu-',
  'api_scope': 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/googletalk'
};

angular.module('UProxyChromeExtension', ['angular-lodash'])
  .constant('googleAuth', new OAuth2('google', OAUTH_CONFIG))
  .constant('GOOG_PROFILE_URL', 'https://www.googleapis.com/oauth2/v1/userinfo')
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
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('model', {}) // application state. determined by backend (packaged app)
  .run([
    '$filter',
    '$http',
    '$rootScope',
    'GOOG_PROFILE_URL',
    'bg',
    'freedom',
    'googleAuth',
    'model',
    function($filter, $http, $rootScope, GOOG_PROFILE_URL, bg, freedom, googleAuth, model) {
      var filter = $filter('filter'),
          messageable = $filter('messageable'),
          onlineNotMessageable = $filter('onlineNotMessageable');

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

      $rootScope.freedomEmit = function (msgName, data) {
        freedom.emit(msgName, data);
      };

      $rootScope.sendMessage = function (contact, msg) {
        // XXX freedom.emit('send-message', {to: contact.userId, msg})
        //     gets intercepted by non-freedom clients and is not received by uproxy clients
        _(contact.clients).filter({status: 'messageable'}).each(function (client) {
          freedom.emit('send-message', {
            to: client.clientId,
            toUserId: contact.userId,
            message: msg});
        });
      };

      $rootScope.changeOption = function (key, value) {
        freedom.emit('change-option', {key: key, value: value});
      };

      var clearedAndRetried = false;
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
                  $rootScope.authGoog();
                }
              } else {
                console.debug('request for', GOOG_PROFILE_URL, 'failed:', resp);
              }
            });
        });
      };
      $rootScope.authGoog();

      bg.clearPopupListeners();
      freedom.emit('open-popup');

      var JSONPatch = jsonpatch.JSONPatch;
      bg.addPopupListener('state-change', function (patch) {
        console.debug('got state change:', patch);
        $rootScope.$apply(function () {
          // XXX jsonpatch can't mutate root object https://github.com/dharmafly/jsonpatch.js/issues/10
          if (patch[0].path === '') {
            angular.copy(patch[0].value, model);
          } else {
            patch = new JSONPatch(patch, true); // mutate = true
            patch.apply(model);
          }
        });
      });
    }
  ]);
