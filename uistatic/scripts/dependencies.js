// Fake dependency which mocks all interactions such that the UI can work.
'use strict';

console.log('This is not a real uProxy frontend.');

// Initialize model object to a mock. (state.js)
var model = state || { identityStatus: {} };
var ui = new UI('fake');

var dependencyInjector = angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    return function (key) { return key; };
  })
  .constant('appChannel', {
    status: {
      connected: true
    },
    emit: function(name, args) {
      console.log('appChannel.emit("' + name + '",', args);
      ui.synchronize();  // Fake sync because there's no backend update.
    }
  })
  .constant('onStateChange', null)
  .constant('ui', ui)
  .constant('model', model)
  .constant('roster', null)
