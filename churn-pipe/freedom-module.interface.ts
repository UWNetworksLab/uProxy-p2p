/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import net = require('../net/net.types');

export interface Message {
  data: ArrayBuffer
  source: net.Endpoint
}

export interface freedom_ChurnPipe {
  bind(localAddress :string,
       localPort :number,
       remoteAddress :string,
       remotePort :number,
       transformerName :string,
       key ?:ArrayBuffer,
       config ?:string) : Promise<void>;
  send(buffer :ArrayBuffer) : Promise<void>;
  sendTo(buffer :ArrayBuffer, to :net.Endpoint) : Promise<void>;

  getLocalEndpoint() : Promise<net.Endpoint>;

  on(t:'message', f:(message:Message) => void) : void;
  on(t:string, f:Function) : void;
}
