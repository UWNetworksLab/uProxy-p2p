// Typescript file for core.rtcdatachannel in:
// https://github.com/freedomjs/freedom/blob/master/interface/core.rtcdatachannel.json
/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='freedom-common.d.ts' />

declare module freedom_RTCDataChannel {

  interface Message {
    // Exactly one of the below must be specified.
    text          ?:string;
    buffer        ?:ArrayBuffer;
    binary        ?:Blob;  // Not yet supported in Chrome.
  }

  // Constructed by |freedom['rtcdatachannel'](id)| where |id| is a string
  // representing the channel id created by an |rtcpeerconnection| object.
  interface RTCDataChannel {
    getLabel() : Promise<string>;
    getOrdered() : Promise<boolean>;
    getMaxPacketLifeTime() : Promise<number>;
    getMaxRetransmits() : Promise<number>;
    getProtocol() : Promise<string>;
    getNegotiated() : Promise<boolean>;
    getId() : Promise<number>;
    getReadyState() : Promise<string>;
    getBufferedAmount() : Promise<number>;

    on(t:'onopen', f:() => void) : void;
    on(t:'onerror', f:() => void) : void;
    on(t:'onclose', f:() => void) : void;
    on(t:'onmessage', f:(m:Message) => void) : void;
    on(t:string, f:Function) : void;

    close() : Promise<void>;
    getBinaryType() : Promise<string>;
    setBinaryType(type:string) : Promise<void>;
    send(message:string) : Promise<void>;
    sendBuffer(message:ArrayBuffer) : Promise<void>;
  }

}

