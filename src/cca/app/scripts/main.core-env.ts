/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

/// <reference path='../../../../../third_party/freedom-typings/freedom-core-env.d.ts' />
/// <reference path='../../../../../third_party/typings/chrome/chrome-app.d.ts'/>

import freedom_types = require('freedom.types');

import CordovaBrowserApi = require('./cordova_browser_api');

import uproxy_core_api = require('../../../interfaces/uproxy_core_api');

export interface OnEmitModule extends freedom_types.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom_types.FreedomModuleFactoryManager<OnEmitModule> {};

// Remember which handlers freedom has installed.
var haveAppChannel :Function;
export var uProxyAppChannel :Promise<freedom_types.OnAndEmit<any,any>> =
    new Promise((F, R) => {
  haveAppChannel = F;
});

export var moduleName = 'uProxy App Top Level';
export var browserApi :CordovaBrowserApi = new CordovaBrowserApi();

console.log('Instantiating UI');
// This instantiation, before the core has even started, should reduce the
// apparent startup time, but runs the risk of leaving the UI non-responsive
// until the core catches up.
// TODO: Add a loading screen, for slow systems.
browserApi.bringUproxyToFront().then(() => {
  console.log('UI instantiation complete');
});

console.log('Loading core');
freedom('generic_core/freedom-module.json', {
  'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
  'debug': 'debug',
  'portType': 'worker'
}).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  console.log('Core loading complete');
  haveAppChannel(uProxyModuleFactory());
});

