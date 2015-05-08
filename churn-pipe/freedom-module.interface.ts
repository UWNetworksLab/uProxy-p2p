/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import net = require('../net/net.types');

export interface freedom_ChurnPipe {
  setTransformer(transformerName :string,
      key ?:ArrayBuffer,
      config ?:string) : Promise<void>;
  bindLocal(publicEndpoint:net.Endpoint) : Promise<void>;
  setBrowserEndpoint(browserEndpoint:net.Endpoint) : Promise<void>;
  bindRemote (remoteEndpoint:net.Endpoint) : Promise<net.Endpoint>;
}
