// Fake dependency which mocks all interactions such that the UI can work.
/// <reference path='../../uproxy.ts' />
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../interfaces/notify.d.ts'/>
/// <reference path='../../interfaces/lib/angular.d.ts' />
/// <reference path='../../generic_ui/scripts/ui.ts' />

console.log('This is not a real uProxy frontend.');

// TODO: Type these.
// declare var state:UI.Model;
declare var angular:any;

var model :UI.Model = {
  networks: {},
  // 'global' roster, which is just the concatenation of all network rosters.
  roster: {}
};

// Initialize model object to a mock. (state.js)
// var model = state;  // || { identityStatus: {} };

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
  public status :StatusObject;
  constructor() {
    this.status = { connected: true };
  }
  reset() {
    console.log('Resetting.');
  }
  sendInstance(clientId) {
    console.log('Sending instance ID to ' + clientId);
  }
  modifyConsent(command) {
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
    ui['syncNetwork_']({
      name: 'google',
      online: true
    });
  }
  logout(network) {
    console.log('Logging out of', network);
    ui['syncNetwork_']({
      name: 'google',
      online: false
    });
  }
  dismissNotification(userId) {
    console.log('Notification seen for ' + userId);
  }
  onUpdate(update, handler) {
    // In the 'real uProxy', this is where the UI installs update handlers for
    // events received from the Core. Since this is a standalone UI, there is
    // only a mock core, and all interaction is fake beyond this point.
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
  .constant('onStateChange', null)
  .constant('ui', ui)
  .constant('model', model)
  .constant('core', mockCore)

// Fake a bunch of interactions from core.
// Starts off being 'offline' to a network.
ui['syncNetwork_']({
  name: 'google',
  online: false
});

ui['syncUser_']({
  network: 'google',
  user: {
    userId: 'alice',
    name: 'Alice uProxy',
    timestamp: Date.now()
  },
  clients: [
    UProxyClient.Status.ONLINE
  ],
  instances: [
  ]
});

ui['DEBUG'] = true;
