// Typescript file for core.tcpsocket in:
// https://github.com/freedomjs/freedom/blob/master/interface/core.js

/// <reference path="../third_party/typings/es6-promise/es6-promise.d.ts" />

// The data types used by TcpSocket
//declare module freedom {
  declare module freedom_TcpSocket {
    interface DisconnectInfo {
      errcode :string;
      message :string;
    }

    interface ReadInfo {
      data :ArrayBuffer;
    }

    interface WriteInfo {
      bytesWritten :number;
    }

    interface SocketInfo {
      connected :boolean;
      localAddress :string;
      localPort :number;
      peerAddress :string;
      peerPort :number;
    }

    interface ConnectInfo {
      socket :number;
      host :string;
      port :number;
    }
  }  // module TcpSockets

  // The TcpSocket class (freedom['core.TcpSocket'])
  interface freedom_TcpSocket {
    listen(address:string, port:number) : Promise<void>;
    connect(hostname:string, port:number) : Promise<void>;
    write(data:ArrayBuffer) : Promise<freedom_TcpSocket.WriteInfo>;
    getInfo() : Promise<freedom_TcpSocket.SocketInfo>;
    close() : Promise<void>;
    // TcpSockets have 3 types of events:
    on(eventType:string, f:Function) : void;
    on(type:'onConnection', f:(i:freedom_TcpSocket.ConnectInfo) => void) : void;
    on(type:'onData', f:(i:freedom_TcpSocket.ReadInfo) => void) : void;
    on(type:'onDisconnect', f:(i:freedom_TcpSocket.DisconnectInfo) => void) : void;
  }

// }
