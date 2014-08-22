// Chrome-specific dependencies.
// TODO: Convert to typescript
'use strict';

// TODO(keroserene): remove once angular is gone.
// if (angular) {
  // angular.module('dependencyInjector', [])
    // .filter('i18n', function () {
      // var getMessage = chrome.i18n.getMessage;
      // return function (key) {
        // return getMessage(key);
      // };
    // })
    // Singletons live in the Chrome Extension's background page.
    // .constant('ui', chrome.extension.getBackgroundPage().ui)
    // .constant('core', chrome.extension.getBackgroundPage().core)
    // .constant('model', chrome.extension.getBackgroundPage().model)
    // .constant('roster', chrome.extension.getBackgroundPage().roster)
// }

var ui = chrome.extension.getBackgroundPage().ui;
var core = chrome.extension.getBackgroundPage().core;
var model = chrome.extension.getBackgroundPage().model;
var roster = chrome.extension.getBackgroundPage().roster;
console.log('Loaded dependencies for Chrome Extension.');
