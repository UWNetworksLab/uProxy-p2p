/// <reference path='../../../../third_party/typings/index.d.ts' />

import logging = require('../../logging/logging');
import piece = require('../piece');

declare const freedom: freedom.FreedomInModuleEnv;

const log: logging.Log = new logging.Log('freedom forwarding socket');

export class FreedomForwardingSocket implements piece.SocksPiece {
  private socket_ = freedom['core.tcpsocket']();

  constructor() {
    this.socket_.on('onData', (info: freedom.TcpSocket.ReadInfo) => {
      this.onData_(info.data);
    });
    this.socket_.on('onDisconnect', (info: freedom.TcpSocket.DisconnectInfo) => {
      this.onDisconnect_();
    });
  }

  private onData_: (buffer: ArrayBuffer) => void;
  public onData = (callback: (buffer: ArrayBuffer) => void): FreedomForwardingSocket => {
    this.onData_ = callback;
    return this;
  }

  private onDisconnect_: () => void;
  public onDisconnect = (callback: () => void): FreedomForwardingSocket => {
    this.onDisconnect_ = callback;
    return this;
  }

  public handleData = (buffer: ArrayBuffer) => {
    this.socket_.write(buffer);
  };

  public handleDisconnect = () => {
    log.debug('SOCKS client has disconnected');
  }

  public connect = (host: string, port: number) => {
    return this.socket_.connect(host, port);
  }
}
