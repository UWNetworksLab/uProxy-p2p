/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../typings/console.d.ts" />
/// <reference path="../typings/freedom-common.d.ts" />

import freedomTypes = require('freedom.i');

export class ErrorMockParentModuleThing implements freedomTypes.ParentModuleThing {
  public on(t:string, f:Function) : void {
    throw new Error('not implemented in mock');
  }
  public emit(t:string, x:any) : void {
    throw new Error('not implemented in mock');
  }
  public provideSynchronous(classFn:Function) : void {
    throw new Error('not implemented in mock');
  }
  public provideAsynchronous(classFn:Function) : void {
    throw new Error('not implemented in mock');
  }
  public providePromises(classFn:Function) : void {
    throw new Error('not implemented in mock');
  }
}

export class ErrorMockFreedomCore implements freedomTypes.Core {
  public getLogger(loggerName:string) : Promise<freedomTypes.Logger> {
    throw new Error('not implemented in mock');
  }
  public createChannel() : Promise<freedomTypes.ChannelSpecifier>{
    throw new Error('not implemented in mock');
  }
  public bindChannel(channelIdentifier:string) : Promise<freedomTypes.Channel> {
    throw new Error('not implemented in mock');
  }
  public getId() : Promise<string[]> {
    throw new Error('not implemented in mock');
  }
}

export class ErrorMockFreedomConsole implements freedom_Console.Console {
  public log(source:string, message:string) : Promise<void> {
    throw new Error('not implemented in mock');
  }
  public debug(source:string, message:string) : Promise<void> {
    throw new Error('not implemented in mock');
  }
  public info(source:string, message:string) : Promise<void> {
    throw new Error('not implemented in mock');
  }
  public warn(source:string, message:string) : Promise<void> {
    throw new Error('not implemented in mock');
  }
  public error(source:string, message:string) : Promise<void> {
    throw new Error('not implemented in mock');
  }
}


export class NullMockModuleSelfConstructor implements freedomTypes.ModuleSelfConstructor {
  public provideSynchronous(classFn:Function) : void {}
  public provideAsynchronous(classFn:Function) : void {}
  public providePromises(classFn:Function) : void {}
}

export class NullMockParentModuleThing
    extends NullMockModuleSelfConstructor
    implements freedomTypes.ParentModuleThing {
  public on(t:string, f:Function) : void {}
  public emit(t:string, x:any) : void {}
}

export class NullMockFreedomCore implements freedomTypes.Core {
  public getLogger(loggerName:string) : Promise<freedomTypes.Logger> {
    return Promise.resolve<freedomTypes.Logger>(null);
  }
  public createChannel() : Promise<freedomTypes.ChannelSpecifier>{
    return Promise.resolve<freedomTypes.ChannelSpecifier>(null);
  }
  public bindChannel(channelIdentifier:string) : Promise<freedomTypes.Channel> {
    return Promise.resolve<freedomTypes.Channel>(null);
  }
  public getId() : Promise<string[]> {
    return Promise.resolve<string[]>(null);
  }
}

export class NullMockFreedomConsole implements freedom_Console.Console {
  public log(source:string, message:string) : Promise<void> {
    return Promise.resolve<void>();
  }
  public debug(source:string, message:string) : Promise<void> {
    return Promise.resolve<void>();
  }
  public info(source:string, message:string) : Promise<void> {
    return Promise.resolve<void>();
  }
  public warn(source:string, message:string) : Promise<void> {
    return Promise.resolve<void>();
  }
  public error(source:string, message:string) : Promise<void> {
    return Promise.resolve<void>();
  }
}

export function makeNullMockFreedomInModuleEnv(
    providerFactories ?: {[name:string] : Function})
    : freedomTypes.FreedomInModuleEnv {

  // Each freedom() call in a module env gives a new on/emit interface to the
  // parent module.
  var freedom : any = () => {
    return new NullMockParentModuleThing();
  }

  // Note: unlike other freedom
  var core_ = new NullMockFreedomCore();
  freedom['core'] = () => { return core_; }

  for(var providerName in providerFactories) {
    freedom[providerName] = providerFactories[providerName];
  }

  //freedom['provideSynchronous'] = () : void => {};
  //freedom['provideAsynchronous'] = () : void => {};
  //freedom['providePromise'] = () : void => {};

  return freedom;
}

export function makeErrorMockFreedomInModuleEnv(
    providerFactories ?: {[name:string] : Function})
    : freedomTypes.FreedomInModuleEnv {
  // Each freedom() call in a module env gives a new on/emit interface to the
  // parent module.
  var freedom : any = () => {
    return new NullMockParentModuleThing();
  }

  // Note: unlike other freedom
  var core_ = new NullMockFreedomCore();
  freedom['core'] = () => { return core_; }

  for(var providerName in providerFactories) {
    freedom[providerName] = providerFactories[providerName];
  }

/*
  freedom['provideSynchronous'] = () : void => {
    throw new Error('not implemented in mock');
  };
  freedom['provideAsynchronous'] = () : void => {
    throw new Error('not implemented in mock');
  };
  freedom['providePromise'] = () : void => {
    throw new Error('not implemented in mock');
  };
*/

  return freedom;
}
