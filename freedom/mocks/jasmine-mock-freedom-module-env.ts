/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../typings/freedom-common.d.ts" />

function makeFakeFreedomInModuleEnv() : freedom.FreedomInModuleEnv {
  var freedomParentModuleOnAndEmitInterface =
      jasmine.createSpyObj('freedom', ['on','emit']);

  var freedom :freedom.FreedomInModuleEnv =
      <freedom.FreedomInModuleEnv> function () : freedom.OnAndEmit<any,any> {
    return freedomParentModuleOnAndEmitInterface;
  }

  freedom['core'] = () : freedom.Core => { return null; }
/*
  jasmine.createSpy().and.returnValue(
      jasmine.createSpyObj(
        'core', ['getLogger', 'createChannel', 'bindChannel']));

  freedom['core.console'] = jasmine.createSpy().and.returnValue(
      jasmine.createSpyObj(
        'core.console', ['debug', 'log', 'info', 'warn', 'error']));

  freedom['provideSynchronous'] = jasmine.createSpy();

*/

  return freedom;
}

var freedom :freedom.FreedomInModuleEnv = makeFakeFreedomInModuleEnv();

export = freedom;
