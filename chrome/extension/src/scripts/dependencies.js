// Chrome-specific dependencies.
'use strict';

angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('onFreedomStateChange', chrome.extension.getBackgroundPage().onFreedomStateChange)
  // Singleton model lives in chrome extension's background page.
  .constant('model', chrome.extension.getBackgroundPage().model)
  // .constant('setIcon', chrome.extension.getBackgroundPage().setIcon)
  .constant('icon', chrome.extension.getBackgroundPage().icon);
  // .constant('icon', chrome.extension.getBackgroundPage().icon);
