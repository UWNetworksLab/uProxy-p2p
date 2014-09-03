/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />

// Note: until bug https://github.com/Microsoft/TypeScript/issues/52 we cannot
// have multiple declare statements for the freedom module in different files.
// We either need all declarations in one file, or use different names. Once
// fixed (Typescript 1.1), we can clean this up and TS will handle merging of
// external declare modules.

// Common on/emit for message passing interfaces.
interface EventDispatchFn<T> { (eventType:string, value?:T) : void; }
interface EventHandlerFn<T> {
  (eventType:string, handler:(eventData:T) => void) : void;
}

interface OnAndEmit<T,T2> {
  on   :EventHandlerFn<T>;
  emit :EventDispatchFn<T2>;
}

// The type for a core provider's 'continuation' function argument. It's
// basically a promise-like thing.
// CONSIDER: generalise the error value to a type-parameter.
interface CoreProviderCallback<T> {
  (fulfill?:T, reject?:{message: string}) : void;
}

declare module freedom {

  // This is the interface that exists in the environment of a core provider's
  // definition.
  module CoreProviderEnv {
    // The interface for the global `fdom` object.
    interface Fdom {
      apis :Apis;
    }
    interface Apis {
      // Register the core provider wheer |classDef| is the class object.
      register(coreProviderName:string, classDef:Function) : void;

      // This sets the object that defines the freedom interface for the given
      // core provider name.
      set(coreProviderName:string, freedomClassSpec:any) : void;
    }
  }

  //----------------------------------------------------------------------------
  // Generic top level freedom interfaces
  //----------------------------------------------------------------------------
  interface PortModule<T,T2> extends OnAndEmit<T,T2> {
    controlChannel :string;
  }

  // The |implementationClass| is a class that is used to create a new instance
  // for every module instance that freedom creates.
  interface Provider {
    providePromise(implementationClass:Object) : void;
  }

  // See |Core_unprivileged| in |core.unprivileged.js|
  interface Core {
    // Create a new channel which which to communicate between modules.
    createChannel<T,T2>() : Promise<ChannelSpecifier<T,T2>>;
    // Given an ChannelEndpointIdentifier for a channel, create a proxy event
    // interface for it.
    bindChannel<T,T2>(identifier:ChannelEndpointIdentifier)
        : Promise<Channel<T,T2>>;
    // Returns the list of identifiers describing the dependency path.
    getId() : Promise<string[]>;
  }

  // Channels are ways that freedom modules can send each other messages.
  interface Channel<T,T2> extends OnAndEmit<T,T2> {
    close() : void;
  }
  // Specification for a channel.
  interface ChannelSpecifier<T,T2> {
    channel     :Channel<T,T2>;  // How to communicate over this channel.
    identifier  :ChannelEndpointIdentifier;
  }
  // An endpoint identifier for a channel. Can be passed over a freedom message-
  // passing boundary.  It is used to create a channel to the freedom module
  // that called createChannel and created this ChannelSpecifier.
  interface ChannelEndpointIdentifier {}

  // This is the first argument given to a core provider's constructor. It is an
  // object that describes the parent module the core provider instance has been
  // created for.
  interface CoreProviderParentApp {
    manifestId :string;
    config :{
      views :{ [viewName:string] : Object };
    };
    global :{
      removeEventListener :(s:string, f:Function, b:boolean) => void;
    };
  }
}  // declare module freedom

interface Freedom {
  // We use this specification so that you can reference any value in freedom by
  // a array-lookup of it's name. One day we'll have a nicer way to do this.
  // This also allows stricter typescript checking (noImplicitAny=true)
  [moduleName:string] : any;

  // The freedom object's on/emit communicate with the parent module. If this is
  // the outer-page, then on/emit communicate with the root module.
  on :EventHandlerFn<any>;
  emit :EventDispatchFn<any>;
  core :() => freedom.Core
}

declare var freedom :Freedom;

interface Window {
  // The freedom config variable can be set in the window to let an application
  // register additional core-providers. When Freedom starts up, if the
  // |freedomcfg| var is defined, it will call it passing it the internal core-
  // provider registration function. |providerName| should be a name of a core-
  // provider as defined in |freedom/interface/core.js|, and the function-
  // argument should be a class that meets that interface of |providerName|.
  freedomcfg(register:(providerName:string, classFn:Function) => void) : void;
}
