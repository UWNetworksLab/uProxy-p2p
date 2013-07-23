'use strict';

angular.module('UProxyChromeExtension', [])
  .filter('chromei18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('bg', chrome.extension.getBackgroundPage())
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('model', {}) // application state. determined by backend (packaged app)
  .run(['$rootScope', 'bg', 'freedom', 'model', function($rootScope, bg, freedom, model) {
    bg.clearPopupListeners();
    freedom.emit('open-popup', '');

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
  }]);
