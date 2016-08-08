/// <reference path='../../../../third_party/typings/index.d.ts' />

export class MockModuleSelfConstructor implements freedom.ModuleSelfConstructor {
  public provideSynchronous(classFn:Function) : void {}
  public provideAsynchronous(classFn:Function) : void {}
  public providePromises(classFn:Function) : void {}
}

export class MockParentModuleThing
    extends MockModuleSelfConstructor
    implements freedom.ParentModuleThing {
  public on(t:string, f:Function) : void {}
  public emit(t:string, x:any) : void {}
}

export class MockFreedomCore implements freedom.Core {
  public getLogger(loggerName:string) : Promise<freedom.Logger> {
    return Promise.resolve<freedom.Logger>(null);
  }
  public createChannel() : Promise<freedom.ChannelSpecifier>{
    return Promise.resolve<freedom.ChannelSpecifier>(null);
  }
  public bindChannel(channelIdentifier:string) : Promise<freedom.Channel> {
    return Promise.resolve<freedom.Channel>(null);
  }
  public getId() : Promise<string[]> {
    return Promise.resolve<string[]>(null);
  }
}

function makeMockFreedomModuleFactory<T>(f:Function)
    : freedom.FreedomModuleFactoryManager<T> {
  var factoryManager :freedom.FreedomModuleFactoryManager<T>;
  factoryManager = <freedom.FreedomModuleFactoryManager<T>>f;
  factoryManager.close = () => { return Promise.resolve<void>(); };
  return factoryManager;
}

export class MockFreedomConsole implements freedom.Console.Console {
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
export function makeMockFreedomInModuleEnv(
    providerFactories ?: {[name:string] : Function})
    : freedom.FreedomInModuleEnv {

  var mockFreedom :freedom.FreedomInModuleEnv;

  var freeedomParentModuleThing_ = new MockParentModuleThing();
  var freedomFn = () => { return freeedomParentModuleThing_; }
  mockFreedom = <freedom.FreedomInModuleEnv>freedomFn;

  mockFreedom['THIS_IS_A_MOCK'] = makeMockFreedomModuleFactory(() => {});

  var core_ = new MockFreedomCore();
  mockFreedom['core'] = makeMockFreedomModuleFactory<freedom.Core>(
      () => { return core_; });

  for(var providerName in providerFactories) {
    mockFreedom[providerName] =
      makeMockFreedomModuleFactory(providerFactories[providerName]);
  }

  return mockFreedom;
}
