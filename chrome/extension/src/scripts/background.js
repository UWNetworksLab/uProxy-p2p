// Assumes that freedom_connector.js has been loaded.
'use strict';
/* jshint -W098 */

// Chrome App Id for UProxy Packaged Chrome App.
var FREEDOM_CHROME_APP_ID = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener(function (details) {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

var freedom = new FreedomConnector(FREEDOM_CHROME_APP_ID,
                                   {name: 'uproxy-extension-to-app-port'});

var onFreedomStateChange = new chrome.Event();

freedom.onConnected.addListener(function () {
  freedom.on('state-change', function (patchMsg) {
    onFreedomStateChange.dispatch(patchMsg);
  });
});
