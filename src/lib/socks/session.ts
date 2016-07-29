/// <reference path='../../../../third_party/typings/browser.d.ts' />

import headers = require('./headers');
import logging = require('../logging/logging');

const log: logging.Log = new logging.Log('socks session');

enum State {
  AWAITING_AUTHS,
  AWAITING_REQUEST,
  AWAITING_CONNECTION,
  CONNECTED,
  DISCONNECTED
}

export interface SocksSession {
  onDataForSocksClient: (callback: (buffer: ArrayBuffer) => void) => SocksSession;
  onForwardingSocketDisconnect: (callback: () => void) => SocksSession;

  handleSocksClientData: (buffer: ArrayBuffer) => void;
  handleDisconnect: () => void;
}

export interface ForwardingSocket {
  onData: (callback: (buffer: ArrayBuffer) => void) => ForwardingSocket;
  onDisconnect: (callback: () => void) => ForwardingSocket;

  handleData: (buffer: ArrayBuffer) => void;
  handleDisconnect: () => void;
}

export class SocksSessionImpl implements SocksSession {
  private state_ = State.AWAITING_AUTHS;
  private forwardingSocket_: any;

  constructor(
    private serverId_: string,
    private id_: string) { }

  private onForwardingSocketRequired_: any;
  public onForwardingSocketRequired = (callback: any) => {
    this.onForwardingSocketRequired_ = callback;
  }

  private sendToSocksClient_: (buffer: ArrayBuffer) => void;
  public onDataForSocksClient = (callback: (buffer: ArrayBuffer) => void): SocksSessionImpl => {
    this.sendToSocksClient_ = callback;
    return this;
  }

  private onForwardingSocketDisconnect_: () => void;
  public onForwardingSocketDisconnect = (callback: () => void): SocksSessionImpl => {
    this.onForwardingSocketDisconnect_ = callback;
    return this;
  }

  public handleSocksClientData = (buffer: ArrayBuffer) => {
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

          this.onForwardingSocketRequired_(
            request.endpoint.address,
            request.endpoint.port).then((forwardingSocket: link.SocksLink) => {
              log.debug('%1/%2: connected to remote endpoint', this.serverId_, this.id_);

              this.forwardingSocket_ = forwardingSocket;

              this.forwardingSocket_.onData((buffer: ArrayBuffer) => {
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
        this.forwardingSocket_.handleData(buffer);
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
