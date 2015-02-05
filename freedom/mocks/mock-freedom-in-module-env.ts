/// <reference path="../../../build/third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="../../../build/third_party/freedom-typings/console.d.ts" />
/// <reference path="../../../build/third_party/freedom-typings/freedom-common.d.ts" />

import freedomTypes = require('freedom.types');


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
  freedom = <freedomTypes.FreedomInModuleEnv>freedomFn;

  var core_ = new SkeletonFreedomCore();
  freedom['core'] = () => { return core_; }

  for(var providerName in providerFactories) {
    freedom[providerName] = providerFactories[providerName];
  }

  return freedom;
}
