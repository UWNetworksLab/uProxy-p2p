/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../typings/console.d.ts" />
/// <reference path="../typings/freedom-common.d.ts" />

import freedomTypes = require('freedom.i');

export class AbstractParentModuleThing implements freedomTypes.ParentModuleThing {
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

export class AbstractFreedomCore implements freedomTypes.Core {
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

export class AbstractFreedomConsole implements freedom_Console.Console {
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


export class SkeletonModuleSelfConstructor implements freedomTypes.ModuleSelfConstructor {
  public provideSynchronous(classFn:Function) : void {}
  public provideAsynchronous(classFn:Function) : void {}
  public providePromises(classFn:Function) : void {}
}

export class SkeletonParentModuleThing
    extends SkeletonModuleSelfConstructor
    implements freedomTypes.ParentModuleThing {
  public on(t:string, f:Function) : void {}
  public emit(t:string, x:any) : void {}
}

export class SkeletonFreedomCore implements freedomTypes.Core {
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

export class SkeletonFreedomConsole implements freedom_Console.Console {
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

// See the definition of freedomTypes.FreedomInModuleEnv for more info on the
// curious type of a freedom object. :)
export function makeSkeletonFreedomInModuleEnv(
    providerFactories ?: {[name:string] : Function})
    : freedomTypes.FreedomInModuleEnv {

  var freedom :freedomTypes.FreedomInModuleEnv;

  var freeedomParentModuleThing_ = new SkeletonParentModuleThing();
  var freedomFn = () => { return freeedomParentModuleThing_; }
  freedom = <any>freedomFn;

  var core_ = new SkeletonFreedomCore();
  freedom['core'] = () => { return core_; }

  for(var providerName in providerFactories) {
    freedom[providerName] = providerFactories[providerName];
  }

  return freedom;
}

export function makeAbstractFreedomInModuleEnv(
    providerFactories ?: {[name:string] : Function})
    : freedomTypes.FreedomInModuleEnv {

  var freedom :freedomTypes.FreedomInModuleEnv;

  var freeedomParentModuleThing_ = new SkeletonParentModuleThing();
  var freedomFn = () => { return freeedomParentModuleThing_; }
  freedom = <any>freedomFn;

  var core_ = new SkeletonFreedomCore();
  freedom['core'] = () => { return core_; }

  for(var providerName in providerFactories) {
    freedom[providerName] = providerFactories[providerName];
  }

  return freedom;
}
