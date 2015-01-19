/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />

declare module freedom {
  // Common on/emit for message passing interfaces.
  interface EventDispatchFn<T> { (eventType:string, value?:T) : void; }
  interface EventHandlerFn<T> {
    (eventType:string, handler:(eventData:T) => void) : void;
  }

  interface OnAndEmit<T,T2> {
    on   :EventHandlerFn<T>;
    emit :EventDispatchFn<T2>;
  }

  interface PortModule<T,T2> extends OnAndEmit<T,T2> {
    controlChannel :string;
  }

  interface Logger {
    debug(...args:any[]) : void;
    info(...args:any[]) : void;
    log(...args:any[]) : void;
    warn(...args:any[]) : void;
    error(...args:any[]) : void;
  }

  // See |Core_unprivileged| in |core.unprivileged.js|
  interface Core {
    // Create a new channel which which to communicate between modules.
    createChannel() : Promise<ChannelSpecifier>;
    // Given an ChannelEndpointIdentifier for a channel, create a proxy event
    // interface for it.
    bindChannel(channelIdentifier:string) : Promise<Channel>;
    // Returns the list of identifiers describing the dependency path.
    getId() : Promise<string[]>;
    getLogger(tag:string) : Promise<Logger>;
  }

  // Channels are ways that freedom modules can send each other messages.
  interface Channel extends OnAndEmit<any,any> {
    close() : void;
  }

  // Specification for a channel.
  interface ChannelSpecifier {
    channel     :Channel;  // How to communicate over this channel.
    // A freedom channel endpoint identifier. Can be passed over a freedom
    // message-passing boundary.  It is used to create a channel to the freedom
    // module that called createChannel and created this ChannelSpecifier.
    identifier  :string;
  }

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

  interface FreedomInCoreEnv extends freedom.OnAndEmit<any,any> {
    // Represents the call to freedom when you create a root module.
    (manifestPath?:string, options?:any): any;

    // We use this specification so that you can reference freedom sub-modules by
    // an array-lookup of it's name. One day, maybe we'll have a nicer way to do
    // this.
    [moduleName:string] : Function;
  }

  interface FreedomInModuleEnv {
    // Represents the call to freedom(), which returns the parent module's
    // freedom stub interface in an on/emit style.
    (): freedom.OnAndEmit<any,any>;

    // Creates an interface to the freedom core provider which can be used to
    // create loggers and channels.
    core :() => freedom.Core

    // We use this specification so that you can reference freedom sub-modules by
    // an array-lookup of it's name. One day, maybe we'll have a nicer way to do
    // this.
    [moduleName:string] : Function;
  }
}
