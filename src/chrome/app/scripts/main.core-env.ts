/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

/// <reference path='../../../../../third_party/typings/freedom/freedom-core-env.d.ts' />
/// <reference path='../../../../../third_party/typings/chrome/chrome-app.d.ts'/>


import Chrome_oauth = require('./chrome_oauth');
import ChromeUIConnector = require('./chrome_ui_connector');

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

// Remember which handlers freedom has installed.
var oauthOptions :{connector:ChromeUIConnector;} = {
  connector: null
};
export var uProxyAppChannel :freedom.OnAndEmit<any,any>;
export var moduleName = 'uProxy App Top Level';

freedom('generic_core/freedom-module.json', {
  'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
  'debug': 'debug',
  'portType': 'worker',
  'oauth': [() => { return new Chrome_oauth(oauthOptions); }]
}).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  uProxyAppChannel = uProxyModuleFactory();
  var chromeUIConnector = new ChromeUIConnector(uProxyAppChannel);

  oauthOptions.connector = chromeUIConnector;
});

// Reply to pings from the uproxy website that are checking if the
// application is installed.
chrome.runtime.onMessageExternal.addListener(
    (request:{checkIfInstalled:boolean}, sender:Object,
     sendResponse:(r:{appInstalled:boolean}) => void) => {
        if (request && request.checkIfInstalled) {
          sendResponse({ appInstalled: true });
        }
        return true;
    });
