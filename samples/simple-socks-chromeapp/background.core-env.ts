/// <reference path='../../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/freedom-core-env.d.ts' />

import freedom_types = require('freedom.types');
export interface OnEmitModule extends freedom_types.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom_types.FreedomModuleFactoryManager<OnEmitModule> {};

var script = document.createElement('script');
script.src = 'freedom-for-chrome/freedom-for-chrome.js';
document.head.appendChild(script);

// Keep a background timeout running continuously, to prevent chrome from
// putting the app to sleep.
function keepAlive() { setTimeout(keepAlive, 5000); }
keepAlive();

// Top level variable to provide console-level access to the module interface.
export var simpleSocks :OnEmitModule;

script.onload = () => {
  freedom('uproxy-lib/simple-socks/freedom-module.json', {
      'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
      'debug': 'debug'
  }).then((simpleSocksFactory:OnEmitModuleFactory) => {
    simpleSocks = simpleSocksFactory();
  }, (e:Error) => { throw e; });
}
