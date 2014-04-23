// Fake dependency which mocks all interactions such that the UI can work.
/// <reference path='../../uproxy.ts' />
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../interfaces/notify.d.ts'/>
/// <reference path='../../generic_ui/scripts/ui.ts' />

console.log('This is not a real uProxy frontend.');

// TODO: Type these.
declare var state:UI.Model;
declare var angular:any;

// Initialize model object to a mock. (state.js)
var model = state;  // || { identityStatus: {} };

class MockNotifications implements INotifications {
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

class MockCore implements uProxy.CoreAPI {
  constuctor() {}
  reset() {
    console.log('Resetting.');
  }
  sendInstance(clientId) {
    console.log('Sending instance ID to ' + clientId);
  }
  modifyConsent(instanceId, action) {
    console.log('Modifying consent.');
  }
  start(instanceId) {
    console.log('Starting to proxy through ' + instanceId);
  }
  stop(instanceId) {
    console.log('Stopping proxy through ' + instanceId);
  }
  updateDescription(description) {
    console.log('Updating description to ' + description);
  }
  changeOption(option) {
    console.log('Changing option ' + option);
  }
  login(network) {
    console.log('Logging in to', network);
  }
  logout(network) {
    console.log('Logging out of', network);
  }
  dismissNotification(userId) {
    console.log('Notification seen for ' + userId);
  }
}

var mockCore = new MockCore();
var ui :uProxy.UIAPI = new UI.UserInterface(
    mockCore,
    new MockNotifications());

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
      ui.sync();  // Fake sync because there's no backend update.
    }
  })
  .constant('onStateChange', null)
  .constant('ui', ui)
  .constant('model', model)
  .constant('roster', null);
