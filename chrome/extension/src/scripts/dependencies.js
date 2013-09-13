'use strict';

angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('onFreedomStateChange', chrome.extension.getBackgroundPage().onFreedomStateChange);
