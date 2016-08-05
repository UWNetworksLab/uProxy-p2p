/// <reference path='../../../../../third_party/typings/index.d.ts'/>
/// <reference path='../../../../../third_party/typings/cordova/splashscreen.d.ts'/>

/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

import CordovaBrowserApi = require('./cordova_browser_api');

import uproxy_core_api = require('../../../interfaces/uproxy_core_api');

declare const freedom: freedom.FreedomInCoreEnv;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

// Remember which handlers freedom has installed.
var haveAppChannel :Function;
export var uProxyAppChannel :Promise<freedom.OnAndEmit<any,any>> =
    new Promise((F, R) => {
  haveAppChannel = F;
});

export var moduleName = 'uProxy App Top Level';
export var browserApi :CordovaBrowserApi = new CordovaBrowserApi();

console.log('Instantiating UI');
// This instantiation, before the core has even started, should reduce the
// apparent startup time, but runs the risk of leaving the UI non-responsive
// until the core catches up.
browserApi.bringUproxyToFront().then(() => {
  console.log('UI instantiation complete');
  if (navigator.splashscreen) {
    navigator.splashscreen.hide();
  }
});

console.log('Loading core');
freedom('generic_core/freedom-module.json', <freedom.FreedomInCoreEnvOptions>{
  'logger': 'lib/loggingprovider/freedom-module.json',
  'debug': 'debug',
  'portType': 'worker'
}).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  console.log('Core loading complete');
  haveAppChannel(uProxyModuleFactory());
});

