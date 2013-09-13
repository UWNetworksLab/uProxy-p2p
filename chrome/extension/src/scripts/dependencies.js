'use strict';

angular.module('dependencyInjector', [])
  .filter('chromei18n', function (i18n) {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('bg', chrome.extension.getBackgroundPage())
  .constant('onFreedomStateChange', chrome.extension.getBackgroundPage().onFreedomStateChange)
  .constant('freedom', chrome.extension.getBackgroundPage().freedom);
