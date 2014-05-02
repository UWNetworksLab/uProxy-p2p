// Chrome-specific dependencies.
'use strict';

angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  // Singletons live in the Chrome Extension's background page.
  .constant('onStateChange', chrome.extension.getBackgroundPage().onStateChange)
  .constant('ui', chrome.extension.getBackgroundPage().ui)
  .constant('core', chrome.extension.getBackgroundPage().core)
  .constant('model', chrome.extension.getBackgroundPage().model)
  .constant('roster', chrome.extension.getBackgroundPage().roster)
