/// <reference path='../../../../third_party/typings/index.d.ts' />

import net = require('net');
import piece = require('../piece');

export class NodeForwardingSocket implements piece.SocksPiece {
  private socket = new net.Socket();

  private onDataCallback: (buffer: ArrayBuffer) => void;
  private onDisconnectCallback: () => void;

  constructor() {
    this.socket.on('data', (buffer: Buffer) => {
      this.onDataCallback(buffer.buffer);
    });
    this.socket.on('end', (info: freedom.TcpSocket.DisconnectInfo) => {
      this.onDisconnectCallback();
    });
  }

  public onDataForSocksClient = (callback: (buffer: ArrayBuffer) => void): NodeForwardingSocket => {
    this.onDataCallback = callback;
    return this;
  }

  public onDisconnect = (callback: () => void): NodeForwardingSocket => {
    this.onDisconnectCallback = callback;
    return this;
  }

  public handleDataFromSocksClient = (buffer: ArrayBuffer) => {
    this.socket.write(new Buffer(buffer));
  };

  public handleDisconnect = () => {
    this.socket.end();
  }

  public connect = (host: string, port: number) => {
    return new Promise((F, R) => {
      this.socket.on('error', (e: any) => {
        R(e);
      });
      return this.socket.connect(port, host, () => {
        F();
      });
    });
  }
}
