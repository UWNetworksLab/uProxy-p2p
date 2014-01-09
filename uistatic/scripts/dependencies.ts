// Fake dependency which mocks all interactions such that the UI can work.
/// <reference path='../common/ui/scripts/notify.d.ts'/>
/// <reference path='../common/ui/scripts/ui.d.ts'/>
console.log('This is not a real uProxy frontend.');

// declare var ui:any;
declare var state:any;
declare var angular:any;

// Initialize model object to a mock. (state.js)
var model = state || { identityStatus: {} };

class mockNotifications implements INotifications {
  setIcon(iconFile) {
    console.log('setting icon to ' + iconFile);
  }
  setLabel(text) {
    console.log('setting label to: ' + text);
  }
  setColor(color) {
    console.log('setting background color of the badge to: ' + color);
  }
}

var ui = new UI(new mockNotifications());

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
