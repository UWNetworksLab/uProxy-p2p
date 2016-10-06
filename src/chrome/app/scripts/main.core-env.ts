/// <reference path='../../../../third_party/typings/index.d.ts'/>

/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

import Chrome_oauth from './chrome_oauth';
import ChromeUIConnector from './chrome_ui_connector';
import * as uproxy_core_api from '../../../interfaces/uproxy_core_api';
import * as _ from 'lodash';

declare const freedom: freedom.FreedomInCoreEnv;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

function getPolicyFromManagedStorage() :Promise<Object> {
  return new Promise((fulfill, reject) => {
    chrome.storage.managed.get(null, (contents) => {
      if (contents) {
        fulfill(contents);
      } else { /* TODO figure out if this is the correct rejection criteria */
        reject(chrome.runtime.lastError);
      }
    });
  });
}

function sendPolicyToCore(contents :Object) :void {
  chromeUIConnector.sendToCore(
      uproxy_core_api.Command.UPDATE_ORG_POLICY,
      contents);
}

// Remember which handlers freedom has installed.
var oauthOptions :{connector:ChromeUIConnector;} = {
  connector: null
};
export var uProxyAppChannel :freedom.OnAndEmit<any,any>;
export var moduleName = 'uProxy App Top Level';

var chromeUIConnector :ChromeUIConnector;

freedom('generic_core/freedom-module.json', <freedom.FreedomInCoreEnvOptions>{
  'logger': 'lib/loggingprovider/freedom-module.json',
  'debug': 'debug',
  'portType': 'worker',
  'oauth': [() => { return new Chrome_oauth(oauthOptions); }]
}).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  uProxyAppChannel = uProxyModuleFactory();
  chromeUIConnector = new ChromeUIConnector(uProxyAppChannel);

  oauthOptions.connector = chromeUIConnector;

  getPolicyFromManagedStorage().then((contents) => {
    if (!_.isEmpty(contents)) {
      sendPolicyToCore(contents);
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

  getPolicyFromManagedStorage().then((contents) => {
    sendPolicyToCore(contents);
  });
});
