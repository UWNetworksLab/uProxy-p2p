'use strict';

angular.module('dependencyInjector', [])
  .filter('chromei18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('bg', chrome.extension.getBackgroundPage())
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('onFreedomStateChange', chrome.extension.getBackgroundPage().onFreedomStateChange);
