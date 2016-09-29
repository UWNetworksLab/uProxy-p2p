/// <reference path='../../../../third_party/typings/index.d.ts' />

import logging = require('../../logging/logging');
import piece = require('../piece');

declare const freedom: freedom.FreedomInModuleEnv;

const log: logging.Log = new logging.Log('freedom forwarding socket');

export class FreedomForwardingSocket implements piece.SocksPiece {
  private socket = freedom['core.tcpsocket']();

  constructor() {
    this.socket.on('onData', (info: freedom.TcpSocket.ReadInfo) => {
      this.onData(info.data);
    });
    this.socket.on('onDisconnect', (info: freedom.TcpSocket.DisconnectInfo) => {
      this.onDisconnect_();
    });
  }

  private onData: (buffer: ArrayBuffer) => void;
  public onDataForSocksClient = (callback: (buffer: ArrayBuffer) => void): FreedomForwardingSocket => {
    this.onData = callback;
    return this;
  }

  private onDisconnect_: () => void;
  public onDisconnect = (callback: () => void): FreedomForwardingSocket => {
    this.onDisconnect_ = callback;
    return this;
  }

  public handleDataFromSocksClient = (buffer: ArrayBuffer) => {
    this.socket.write(buffer);
  };

  public handleDisconnect = () => {
    log.debug('SOCKS client has disconnected');
  }

  public connect = (host: string, port: number) => {
    return this.socket.connect(host, port);
  }
}
