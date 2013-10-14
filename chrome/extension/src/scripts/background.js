// Assumes that freedom_connector.js has been loaded.
'use strict';
/* jshint -W098 */

console.log('Initializing chrome extension background page...');

// Chrome App Id for UProxy Packaged Chrome App.
var FREEDOM_CHROME_APP_ID = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener(function (details) {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

var onStateChange = new chrome.Event();

var model = {};  // Singleton angularjs model for either popup or options.

var Icon = function() {
  this.set = function(path) {
    console.log('Setting browser icon to: ' + path);
    chrome.browserAction.setIcon({
      path: path
    });
  };
  this.label = function(text) {
    console.log('Setting browser badge to: ' + text);
    chrome.browserAction.setBadgeText({
      text: text
    });
  };
};
var icon = new Icon();

// For maintaining a single roster with various sort methods.
var Roster = function() {
  this.all = [];
  this.updateContact = function(c) {
    if (all.indexOf(c) < 0)
      all.push(c);
  }
};
var roster = new Roster();

// Connect to the App.
console.log('Connecting to App...');
var connectedToApp = false;
var appChannel = new FreedomConnector(FREEDOM_CHROME_APP_ID, {
    name: 'uproxy-extension-to-app-port' });


function wireUItoApp() {
  console.log('Wiring UI to backend...');
  // Update the model with a JSON patch.
  appChannel.on('state-change', function(patchMsg) {
    console.log(patchMsg[0]);
    if (patchMsg[0].path === '') {
      model = patchMsg[0].value;
    } else {
      jsonpatch.apply(model, patchMsg);
      console.log(model);
    }
    // This event allows angular to bind listeners and update the DOM.
    onStateChange.dispatch(patchMsg);
  });
}
  // Attach state-change listener to update UI from the backend.
appChannel.onConnected.addListener(wireUItoApp);

function reconnectToApp() {
  console.log('Disconnected. Attempting to reconnect to app...');
  appChannel.connect();
}

function initialize() {
  appChannel.emit('ui-ready');
}

// Automatically attempt to reconnect when disconnected.
appChannel.onConnected.addListener(initialize);
appChannel.onDisconnected.addListener(reconnectToApp);

// appChannel.onDisconnected.removeListener(wireUItoApp);

window.onunload = function() {
  // appChannel.removeListener(onStateChange);
  appChannel.onConnected.removeListener(wireUItoApp);
};
appChannel.connect();
