// Typescript file for:
// https://www.github.com/freedomjs/freedom/interface/transport.js

/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />

//declare module freedom {
  declare module freedom_Transport {
    // onData events.
    export interface IncomingMessage {
      tag:string;
      data:ArrayBuffer;
    }
  }

  interface freedom_Transport {
    // TODO(yangoon): define a type for signalling channels (proxy)
    setup(name:string, proxy:any) : Promise<void>;
    send(tag:string, data:ArrayBuffer) : Promise<void>;
    close() : Promise<void>;

    on(eventType:string, f:Function) : void;
    on(eventType:'onData', f:(message:freedom_Transport.IncomingMessage) => void) : void;
    on(eventType:'onClose', f:() => void) : void;
  }
// }
