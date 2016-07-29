/// <reference path='../../../../../third_party/typings/browser.d.ts' />

import logging = require('../../logging/logging');
import session = require('../session');

declare const freedom: freedom.FreedomInModuleEnv;

const log: logging.Log = new logging.Log('freedom forwarding socket');

export class FreedomSocksSocket implements session.ForwardingSocket {
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
  public onData = (callback: (buffer: ArrayBuffer) => void): FreedomSocksSocket => {
    this.onData_ = callback;
    return this;
  }

  private onDisconnect_: () => void;
  public onDisconnect = (callback: () => void): FreedomSocksSocket => {
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
