// Fake dependency which mocks all interactions such that the UI can work.
'use strict';

console.log('This is not a real uProxy frontend.');

var model = {
  identityStatus: {
  }
};
var ui = new UI();

angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    return function (key) { return key; };
  })
  .constant('appChannel', {
    status: {
      connected: true
    },
    emit: function() {
      console.log('Called emit on appchannel.');
    }
  })
  .constant('onStateChange', null)
  .constant('ui', ui)
  .constant('model', model)
  .constant('roster', null)
