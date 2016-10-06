/// <reference path='../../../third_party/typings/index.d.ts' />

import * as churn_types from '../churn/churn.types';
import * as net from '../net/net.types';

export interface MirrorMapping {
  local: net.Endpoint;
  remote: net.Endpoint;
}

export interface freedom_ChurnPipe {
  setTransformer(config:churn_types.TransformerConfig) : Promise<void>;
  bindLocal(publicEndpoint:net.Endpoint) : Promise<void>;
  addBrowserEndpoint(browserEndpoint:net.Endpoint) : Promise<void>;
  bindRemote(remoteEndpoint:net.Endpoint) : Promise<void>;
  shutdown() : Promise<void>;
  on(name:'mappedAddress', listener:(event:MirrorMapping) => void) : void;
  on(name:string, listener:(event:Object) => void) : void;
}
