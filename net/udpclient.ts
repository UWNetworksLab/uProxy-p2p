/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/udp-socket.d.ts' />

import net = require('./net.types');

import UdpLib = freedom_UdpSocket;

/**
 * Represents a UDP socket.
 * TODO: this is so similar to udprelay.ts that they can almost certainly
 *       be merged into one
 */
class UdpClient {

  /**
   * Socket on which we are sending and receiving messages.
   */
  private socket:UdpLib.Socket;

  // Address and port to which the "client-side" socket is bound.
  private address_:string;
  private port_:number;

  constructor (
    private destAddress_:string,
    private destPort_:number,
    private onData_:(data:ArrayBuffer) => any) {
    this.socket = freedom['core.udpsocket']();
  }

  /**
   * Returns a promise to create a socket, bind to the specified address and
   * port, and start relaying events. Specify port zero to have the system
   * choose a free port.
   */
  public bind() : Promise<net.Endpoint> {
    // TODO: not sure what else this should be?
    return this.socket.bind('127.0.0.1', 0)
        .then((endpoint:net.Endpoint) => {
          // Record the address and port on which our socket is listening.
          this.address_ = endpoint.address;
          this.port_ = endpoint.port;
          dbg('listening on : ' + JSON.stringify(endpoint));
          this.socket.on('onData', this.onSocksClientData);
          return endpoint;
        });
  }

  private onSocksClientData = (recvFromInfo:UdpLib.RecvFromInfo) => {
    this.onData_(recvFromInfo.data);
  }

  /**
   * Returns a promise to close the socket.
   */
  public close = () => {
    return this.socket.destroy();
  }

  /**
   * Returns a promise to send data to the client.
   * This is intended for relaying responses from remote servers back to
   * the client.
   */
  public send(buffer:ArrayBuffer) : Promise<number> {
    // TODO: throw error if socket not bound
    return this.socket.sendTo(buffer, this.destAddress_, this.destPort_);
  }

  /**
   * Returns the address on which the local socket associated with this
   * relay is listening.
   */
  public getAddress = () => {
    return this.address_;
  }

  /**
   * Returns the port on which the local socket associated with this
   * relay is listening.
   */
  public getPort = () => {
    return this.port_;
  }
}

export = UdpClient;

var modulePrefix_ = '[Net.UdpClient] ';
function dbg(msg:string) { console.log(modulePrefix_ + msg); }
function dbgWarn(msg:string) { console.warn(modulePrefix_ + msg); }
function dbgErr(msg:string) { console.error(modulePrefix_ + msg); }
