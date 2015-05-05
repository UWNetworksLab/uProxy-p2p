/// <reference path='../../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/freedom-core-env.d.ts' />

import freedom_types = require('freedom.types');
interface OnEmitModule extends freedom_types.OnAndEmit<any,any> {};
interface OnEmitModuleFactory extends
  freedom_types.FreedomModuleFactoryManager<OnEmitModule> {};

var script = document.createElement('script');
script.src = 'freedom-for-chrome/freedom-for-chrome.js';
document.head.appendChild(script);

// Keep a background timeout running continuously, to prevent chrome from
// putting the app to sleep.
function keepAlive() { setTimeout(keepAlive, 5000); }
keepAlive();

// Top level variable to provide console-level access to the module interface.
var echo :OnEmitModule;

script.onload = () => {
  freedom('uproxy-lib/echo/freedom-module.json', {
      'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
      'debug': 'debug'
  }).then((echoFactory:OnEmitModuleFactory) => {
    echo = echoFactory();
    echo.emit('start', { address: '127.0.0.1', port: 9998 });
  }, (e:Error) => {
    console.error('could not load freedom: ' + e.message);
  });
}
