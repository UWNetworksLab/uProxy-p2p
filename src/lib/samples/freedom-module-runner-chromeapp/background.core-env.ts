/// <reference path='../../../../third_party/typings/index.d.ts' />

declare const freedom: freedom.FreedomInCoreEnv;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

var script = document.createElement('script');
script.src = 'freedom-for-chrome/freedom-for-chrome.js';
document.head.appendChild(script);

// Keep a background timeout running continuously, to prevent chrome from
// putting the app to sleep.
function keepAlive() { setTimeout(keepAlive, 5000); }
keepAlive();

export var freedomModule :OnEmitModule = null;

export function runFreedomModule(modulePath:string) :void {
  freedom(modulePath, {
      'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
      'debug': 'debug'
  }).then((freedomModuleFactory:OnEmitModuleFactory) => {
    freedomModule = freedomModuleFactory();
  }, (e:Error) => { throw e; });
}


console.info(
  'This is a sample app to run top level freedom modules. \n' +
  'This can be helpful to debug integration test failures, for example. + \n' +
  'Example usage: \n ' +
  '  browserified_exports.runFreedomModule(' +
  '\'uproxy-networking/integration-tests/tcp/freedom-module.json\'); \n' +
  'or \n' +
  '  browserified_exports.runFreedomModule(' +
  '\'uproxy-networking/simple-socks/freedom-module.json\'); \n' +
  'Then, once loaded, you can bind the module with something like this: \n' +
  '  var m = browserified_exports.freedomModule; \n'
);
