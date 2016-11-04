/// <reference path='../../../third_party/cordova/splashscreen.d.ts'/>

/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

import { CordovaBrowserApi } from './cordova_browser_api';

import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

declare const freedom: freedom.FreedomInCoreEnv;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

export var moduleName = 'uProxy App Top Level';

// TODO(fortuna): Move browser api logic directly here. No need for the extra layer.
var browserApi :CordovaBrowserApi = new CordovaBrowserApi();

console.log('Loading core');
export var uProxyAppChannel = freedom(
    'generic_core/freedom-module.json',
    <freedom.FreedomInCoreEnvOptions>{
      'logger': 'lib/loggingprovider/freedom-module.json',
      'debug': 'debug',
      'portType': 'worker'
    }
).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  console.log('Core loading complete');
  return uProxyModuleFactory();
});

chrome.app.runtime.onLaunched.addListener(function() {
  // Wait for core to finish loading.
  uProxyAppChannel.then(() => {
    chrome.app.window.create('index.html', {}, () => {
      if (navigator.splashscreen) {
        navigator.splashscreen.hide();
      }
    });
  });
});