// Typescript file for core.udpsocket in:
// https://github.com/freedomjs/freedom/blob/master/interface/core.js

/// <reference path="../../../build/third_party/typings/es6-promise/es6-promise.d.ts" />

//declare module freedom {

  declare module freedom_UdpSocket {
    // Type for the chrome.socket.getInfo callback:
    //   https://developer.chrome.com/apps/sockets_udp#type-SocketInfo
    // This is also the type returned by getInfo().
    interface SocketInfo {
      // Note that there are other fields but these are the ones we care about.
      localAddress:string;
      localPort:number;
    }

    // Type for the chrome.socket.recvFrom callback:
    //   http://developer.chrome.com/apps/socket#method-recvFrom
    // This is also the type returned to onData callbacks.
    interface RecvFromInfo {
      resultCode:number;
      address:string;
      port:number;
      data:ArrayBuffer;
    }

    interface Implementation {
      bind(address:string, port:number, continuation:(result:number) => void)
          : void;
      sendTo(data:ArrayBuffer, address:string, port:number,
              continuation:(bytesWritten:number) => void) : void;
      destroy(continuation:() => void) : void;
      getInfo(continuation:(socketInfo:SocketInfo) => void) : void;
    }

    interface Socket {
      bind:any;
      sendTo:any;
      destroy:any;
      on:any;
      getInfo:any;
    }
  }
// }
