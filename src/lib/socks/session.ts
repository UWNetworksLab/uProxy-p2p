/// <reference path='../../../third_party/typings/index.d.ts' />

import headers = require('./headers');
import piece = require('./piece');
import logging = require('../logging/logging');

const log: logging.Log = new logging.Log('socks session');

enum State {
  AWAITING_AUTHS,
  AWAITING_REQUEST,
  AWAITING_CONNECTION,
  CONNECTED,
  DISCONNECTED
}

export class SocksSession implements piece.SocksPiece {
  private state_ = State.AWAITING_AUTHS;

  // Connection to the remote server. This is created once the SOCKS
  // client has sent us the address with which it wishes to connect.
  private forwardingSocket_: piece.SocksPiece;

  constructor(
    private serverId_: string,
    private id_: string) { }

  private getForwardingSocket_: (host: string, port: number) => Promise<piece.SocksPiece>;
  private sendToSocksClient_: (buffer: ArrayBuffer) => void;
  private onForwardingSocketDisconnect_: () => void;

  public onForwardingSocketRequired = (callback: (host: string, port: number) => Promise<piece.SocksPiece>) => {
    this.getForwardingSocket_ = callback;
  }

  // Sets a callback which is invoked when there is something to be sent
  // to the SOCKS client.
  public onDataForSocksClient = (callback: (buffer: ArrayBuffer) => void): SocksSession => {
    this.sendToSocksClient_ = callback;
    return this;
  }

  public onDisconnect = (callback: () => void): SocksSession => {
    this.onForwardingSocketDisconnect_ = callback;
    return this;
  }

  // This is called with data from the SOCKS client. We almost always want to send
  // this to the forwarding socket except during SOCKS protocol negotiation, in which
  // case we need to decode the SOCKS headers and reply back to the SOCKS client.
  public handleDataFromSocksClient = (buffer: ArrayBuffer) => {
    log.debug('%1/%2: received %3 bytes from SOCKS client', this.serverId_, this.id_, buffer.byteLength);
    switch (this.state_) {
      case State.AWAITING_AUTHS:
        try {
          headers.interpretAuthHandshakeBuffer(buffer);
          this.state_ = State.AWAITING_REQUEST;
          this.sendToSocksClient_(headers.composeAuthResponse(headers.Auth.NOAUTH));
        } catch (e) {
          // TODO: send error to the SOCKS client and disconnect
          log.warn('%1/%2: could not parse auths: %3', this.serverId_, this.id_, e.message);
          this.state_ = State.DISCONNECTED;
        }
        break;
      case State.AWAITING_REQUEST:
        try {
          const request = headers.interpretRequestBuffer(buffer);

          // TODO: check for Command.TCP_CONNECT
          // TODO: check is valid and allowed address
          log.debug('%1/%2: requested endpoint: %3', this.serverId_, this.id_, request.endpoint);
          this.state_ = State.AWAITING_CONNECTION;

          this.getForwardingSocket_(
            request.endpoint.address,
            request.endpoint.port).then((forwardingSocket: piece.SocksPiece) => {
              log.info('%1/%2: connected to remote endpoint', this.serverId_, this.id_);

              this.forwardingSocket_ = forwardingSocket;

              this.forwardingSocket_.onDataForSocksClient((buffer: ArrayBuffer) => {
                log.debug('%1/%2: received %3 bytes from forwarding socket', this.serverId_, this.id_, buffer.byteLength);
                this.sendToSocksClient_(buffer);
              });

              this.forwardingSocket_.onDisconnect(() => {
                log.debug('%1/%2: forwarding socket has disconnected', this.serverId_, this.id_);
                this.onForwardingSocketDisconnect_();
              });

              this.state_ = State.CONNECTED;
              this.sendToSocksClient_(headers.composeResponseBuffer({
                reply: headers.Reply.SUCCEEDED,
                endpoint: {
                  address: 'TODO',
                  port: 0
                }
              }));
            }, (e: freedom.Error) => {
              log.warn('%1/%2: failed to connect to remote endpoint: %3', this.serverId_, this.id_, e);
              this.sendToSocksClient_(headers.composeResponseBuffer({
                // TODO: full range of error codes
                reply: headers.Reply.FAILURE
              }));
            });
        } catch (e) {
          // TODO: send error to the SOCKS client
          log.warn('%1/%2: could not parse request: %3', this.serverId_, this.id_, e.message);
          this.state_ = State.DISCONNECTED;
          // this.socksClientLink_.handleDisconnect();
        }
        break;
      case State.CONNECTED:
        this.forwardingSocket_.handleDataFromSocksClient(buffer);
        break;
      default:
        // TODO: should we disconnect at this point?
        log.warn('%1/%2: ignoring bytes unexpectedly received in state %3',
          this.serverId_, this.id_, State[this.state_]);
    }
  }

  // Invoked when there is no longer a connection to the SOCKS client.
  public handleDisconnect = () => {
    log.debug('%1/%2: SOCKS client has disconnected', this.serverId_, this.id_);
    this.forwardingSocket_.handleDisconnect();
  }
}
