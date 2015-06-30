/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

/// <reference path='../../../../../third_party/freedom-typings/freedom-core-env.d.ts' />
/// <reference path='../../../../../third_party/typings/chrome/chrome-app.d.ts'/>

import freedom_types = require('freedom.types');

import Chrome_oauth = require('./chrome_oauth');
import ChromeUIConnector = require('./chrome_ui_connector');
import uproxy_core_api = require('../../../interfaces/uproxy_core_api');

export interface OnEmitModule extends freedom_types.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom_types.FreedomModuleFactoryManager<OnEmitModule> {};

// Remember which handlers freedom has installed.
var oauthOptions :{connector:ChromeUIConnector;} = {
  connector: null
};
export var uProxyAppChannel :freedom_types.OnAndEmit<any,any>;
export var moduleName = 'uProxy App Top Level';

var needToSendInstalledMsgToUi = false;

// When the app is installed, inform the extension.
chrome.runtime.onInstalled.addListener((details :chrome.runtime.InstalledDetails) => {
  if (details.reason !== 'install') {
    return;
  }
  if (oauthOptions.connector) {
    oauthOptions.connector.onceConnected.then(() => {
      oauthOptions.connector.sendToUI(uproxy_core_api.Update.APP_INSTALLED);
    });
  } else {
    // If the ui connector has not been initialized yet, set a flag so that
    // the installed message is sent once the connector is ready.
    needToSendInstalledMsgToUi = true;
  }

});

freedom('generic_core/freedom-module.json', {
  'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
  'debug': 'debug',
  'portType': 'worker',
  'oauth': [() => { return new Chrome_oauth(oauthOptions); }]
}).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  uProxyAppChannel = uProxyModuleFactory();
  oauthOptions.connector = new ChromeUIConnector(uProxyAppChannel);
  if (needToSendInstalledMsgToUi) {
    oauthOptions.connector.onceConnected.then(() => {
      oauthOptions.connector.sendToUI(uproxy_core_api.Update.APP_INSTALLED);
      needToSendInstalledMsgToUi = false;
    });
  }
});

// Reply to pings from the uproxy website that are checking if the
// application is installed.
chrome.runtime.onMessageExternal.addListener(
    (request:Object, sender:Object,
     sendResponse:(r:{message:string}) => void) => {
        if (request) {
          sendResponse({message: "Application installed."});
        }
        return true;
    });
