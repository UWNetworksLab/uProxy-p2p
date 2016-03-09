/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

/// <reference path='../../../../../third_party/typings/chrome/chrome-app.d.ts'/>
/// <reference path='../../../../../third_party/typings/freedom/freedom-core-env.d.ts' />
/// <reference path='../../../../../third_party/typings/lodash/lodash.d.ts' />



import Chrome_oauth = require('./chrome_oauth');
import ChromeUIConnector = require('./chrome_ui_connector');
import uproxy_core_api = require('../../../interfaces/uproxy_core_api');
import _ = require('lodash');

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

// Remember which handlers freedom has installed.
var oauthOptions :{connector:ChromeUIConnector;} = {
  connector: null
};
export var uProxyAppChannel :freedom.OnAndEmit<any,any>;
export var moduleName = 'uProxy App Top Level';

var chromeUIConnector :ChromeUIConnector;

freedom('generic_core/freedom-module.json', <freedom.FreedomInCoreEnvOptions>{
  'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
  'debug': 'debug',
  'portType': 'worker',
  'oauth': [() => { return new Chrome_oauth(oauthOptions); }]
}).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  uProxyAppChannel = uProxyModuleFactory();
  chromeUIConnector = new ChromeUIConnector(uProxyAppChannel);

  oauthOptions.connector = chromeUIConnector;

  chrome.storage.managed.get(null, (contents) => {
    if (!_.isEmpty(contents)) {
      chromeUIConnector.sendToCore(
          uproxy_core_api.Command.UPDATE_ORG_POLICY,
          contents);
    }
  });
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

chrome.storage.onChanged.addListener((properties :Object, namespace :string) => {
  if (namespace != 'managed') {
    // we only care about the managed storage
    return;
  }

  chrome.storage.managed.get(null, (contents) => {
    chromeUIConnector.sendToCore(
        uproxy_core_api.Command.UPDATE_ORG_POLICY,
        contents);
  });
});
