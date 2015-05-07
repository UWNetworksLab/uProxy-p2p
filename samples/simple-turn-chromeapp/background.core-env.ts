/// <reference path='../../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/freedom-core-env.d.ts' />

import freedom_types = require('freedom.types');
export interface OnEmitModule extends freedom_types.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom_types.FreedomModuleFactoryManager<OnEmitModule> {};

var script = document.createElement('script');
script.src = 'freedom-for-chrome/freedom-for-chrome.js';
document.head.appendChild(script);

export var simpleTurn :OnEmitModule;

script.onload = () => {
  freedom('freedom-module.json', {
      'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
      'debug': 'debug'
  }).then(function(simpleTurnFactory:OnEmitModuleFactory) {
    simpleTurn = simpleTurnFactory();
  }, (e:Error) => {
    console.error('could not load freedom: ' + e.message);
  });
}
