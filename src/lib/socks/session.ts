/// <reference path='../../../third_party/typings/index.d.ts' />

import headers = require('./headers');
import piece = require('./piece');

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

  constructor(private id_: string) {
  }

  private getForwardingSocket_: (host: string, port: number) => Promise<piece.SocksPiece>;
  private sendToSocksClient_: (buffer: ArrayBuffer) => void;
  private onForwardingSocketDisconnect_: () => void;

  public onForwardingSocketRequired = (callback: (host: string, port: number) => Promise<piece.SocksPiece>) => {
    this.getForwardingSocket_ = callback;
    return this;
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
    switch (this.state_) {
      case State.AWAITING_AUTHS:
        try {
          headers.interpretAuthHandshakeBuffer(buffer);
          this.state_ = State.AWAITING_REQUEST;
          this.sendToSocksClient_(headers.composeAuthResponse(headers.Auth.NOAUTH));
        } catch (e) {
          // TODO: send error to the SOCKS client and disconnect
          console.warn(this.id_ + ': could not parse auths', e);
          this.state_ = State.DISCONNECTED;
        }
        break;
      case State.AWAITING_REQUEST:
        try {
          const request = headers.interpretRequestBuffer(buffer);

          // TODO: check for Command.TCP_CONNECT
          // TODO: check is valid and allowed address
          console.info(this.id_ + ': requested endpoint: ' +
            request.endpoint.address + ':' + request.endpoint.port);
          this.state_ = State.AWAITING_CONNECTION;

          this.getForwardingSocket_(
            request.endpoint.address,
            request.endpoint.port).then((forwardingSocket: piece.SocksPiece) => {
              console.info(this.id_ + ': connected to remote endpoint');

              this.forwardingSocket_ = forwardingSocket;

              this.forwardingSocket_.onDataForSocksClient((buffer: ArrayBuffer) => {
                this.sendToSocksClient_(buffer);
              });

              this.forwardingSocket_.onDisconnect(() => {
                console.info(this.id_ + ': forwarding socket disconnected');
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
              console.warn(this.id_ + ': could not connect to remote endpoint', e);
              this.sendToSocksClient_(headers.composeResponseBuffer({
                // TODO: full range of error codes
                reply: headers.Reply.FAILURE
              }));
              // TODO: disconnect?
            });
        } catch (e) {
          // TODO: send error to the SOCKS client
          console.warn(this.id_ + ': could not parse request', e);
          this.state_ = State.DISCONNECTED;
          // TODO: disconnect?
        }
        break;
      case State.CONNECTED:
        this.forwardingSocket_.handleDataFromSocksClient(buffer);
        break;
      default:
        // TODO: should we disconnect at this point?
        console.warn(this.id_ + ': ignoring bytes unexpectedly received in state ' + State[this.state_]);
    }
  }

  // Invoked when there is no longer a connection to the SOCKS client.
  public handleDisconnect = () => {
    console.info(this.id_ + ': client disconnected');
    // TODO: this check is kinda ugly - why is anybody calling this *before*
    //       the forwarding socket has been created?
    if (this.forwardingSocket_) {
      this.forwardingSocket_.handleDisconnect();
    }
  }
}
