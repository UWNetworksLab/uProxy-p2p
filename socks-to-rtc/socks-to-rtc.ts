/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import handler = require('../handler/queue');
import net = require('../net/net.types');
import logging = require('../logging/logging');
import peerconnection = require('../webrtc/peerconnection');
import Pool = require('../pool/pool');
import socks = require('../socks-common/socks-headers');
import tcp = require('../net/tcp');

// SocksToRtc passes socks requests over WebRTC datachannels.
module SocksToRtc {
  var log :logging.Log = new logging.Log('SocksToRtc');

  // The |SocksToRtc| class runs a SOCKS5 proxy server which passes requests
  // remotely through WebRTC peer connections.
  // TODO: rename this 'Server'.
  // TODO: Extract common code for this and SocksToRtc:
  //         https://github.com/uProxy/uproxy/issues/977
  export class SocksToRtc {

    // Call this to initiate shutdown.
    private fulfillStopping_ :() => void;
    private onceStopping_ = new Promise((F, R) => {
      this.fulfillStopping_ = F;
    });

    // Fulfills once the SOCKS server has terminated and the TCP server
    // and peerconnection have been shutdown.
    // This can happen in response to:
    //  - startup failure
    //  - TCP server or peerconnection failure
    //  - manual invocation of stop()
    // Should never reject.
    private onceStopped_ :Promise<void>;

    // The two Queues below only count bytes transferred between the SOCKS
    // client and the remote host(s) the client wants to connect to. WebRTC
    // overhead (DTLS headers, ICE initiation, etc.) is not included (because
    // WebRTC does not provide easy access to that data) nor is SOCKS
    // protocol-related data (because it's sent via string messages).
    // All Sessions created in one instance of SocksToRtc will share and
    // push numbers to the same queues (belonging to that instance of SocksToRtc).
    // Queue of the number of bytes received from the peer. Handler is typically
    // defined in the class that creates an instance of SocksToRtc.
    private bytesReceivedFromPeer_ :handler.Queue<number, void> =
        new handler.Queue<number, void>();

    // Queue of the number of bytes sent to the peer. Handler is typically
    // defined in the class that creates an instance of SocktsToRtc.
    private bytesSentToPeer_ :handler.Queue<number,void> =
        new handler.Queue<number, void>();

    // Tcp server that is listening for SOCKS connections.
    private tcpServer_       :tcp.Server;

    // The connection to the peer that is acting as the endpoint for the proxy
    // connection.
    private peerConnection_ :peerconnection.PeerConnection<Object>;

    // This pool manages the PeerConnection's datachannels.
    private pool_ : Pool;

    // Event listener registration function.  When running in freedom, this is
    // not defined, and the corresponding functionality is inserted by freedom
    // on the consumer side.
    public on : (t:string, f:(m:any) => void) => void;
    // Database of event listeners for fallback implementation of |on|.
    private listeners_ : { [s:string]: (m:any) => void };
    // CONSIDER: Remove |on| and |listeners_| once all users of this class use
    // it via freedom, or determine a better long-term plan for supporting
    // events compatibly with and without freedom
    // (https://github.com/uProxy/uproxy/issues/733).

    // Note: The optional |dispatchEvent_| is for when this class is loaded as a
    // freedom module.
    constructor(private dispatchEvent_?:(t:string, m:Object) => void) {
      if (!this.dispatchEvent_) {
        // CONSIDER: Remove this code once all users of this class move to
        // freedom.  See https://github.com/uProxy/uproxy/issues/733 for
        // possible solutions.
        this.listeners_ = {};
        this.on = this.fallbackOn_;
        this.dispatchEvent_ = this.fallbackDispatchEvent_;
      }
    }

    // Starts the SOCKS server with the supplied TCP server and peerconnection.
    // Returns a promise that resolves when the server is ready to use.
    public start = (
        tcpServer:tcp.Server,
        peerconnection:peerconnection.PeerConnection<Object>)
        : Promise<net.Endpoint> => {
      if (this.tcpServer_) {
        throw new Error('already configured');
      }
      this.tcpServer_ = tcpServer;
      this.tcpServer_.connectionsQueue
          .setSyncHandler(this.makeTcpToRtcSession_);
      this.peerConnection_ = peerconnection;
      this.pool_ = new Pool(this.peerConnection_, 'SocksToRtc');

      this.peerConnection_.signalForPeerQueue.setSyncHandler(
          this.dispatchEvent_.bind(this, 'signalForPeer'));

      this.bytesSentToPeer_.setSyncHandler(
          this.dispatchEvent_.bind(this, 'bytesSentToPeer'));
      this.bytesReceivedFromPeer_.setSyncHandler(
          this.dispatchEvent_.bind(this, 'bytesReceivedFromPeer'));

      // Start and listen for notifications.
      peerconnection.negotiateConnection();
      var onceReady :Promise<net.Endpoint> =
        Promise.all<any>([
          tcpServer.listen(),
          peerconnection.onceConnected
        ])
        .then((answers:any[]) => {
          return tcpServer.onceListening();
        });

      // Shutdown if startup fails or when the server socket or
      // peerconnection terminates.
      onceReady.catch(this.fulfillStopping_);
      this.tcpServer_.onceShutdown().then((kind:tcp.SocketCloseKind) => {
        log.info('server socket closed: %1', tcp.SocketCloseKind[kind]);
      }).then(this.fulfillStopping_);
      this.peerConnection_.onceClosed
        .then(() => {
          log.info('peerconnection terminated');
        }, (e:Error) => {
          log.error('peerconnection terminated with error: %1', [e.message]);
        })
        .then(this.fulfillStopping_);
      this.onceStopped_ = this.onceStopping_.then(this.stopResources_);
      this.onceStopped_.then(this.dispatchEvent_.bind(this, 'stopped'));

      var rejectOnStopping = new Promise((F, R) => {
        this.onceStopping_.then(R);
      });
      return Promise.race([onceReady, rejectOnStopping]);
    }

    // Initiates shutdown of the TCP server and peerconnection.
    // Returns onceStopped.
    public stop = () : Promise<void> => {
      log.info('stop requested');
      this.fulfillStopping_();
      return this.onceStopped_;
    }

    // An implementation of dispatchEvent to use if none has been provided
    // (i.e. when this class is not being used as a freedom    // module).
    // For simplicity, only one listener per message type is supported.
    private fallbackDispatchEvent_ = (t:string, msg:any) : void => {
      var listener = this.listeners_[t];
      if (listener) {
        listener(msg);
      }
    }

    // Fallback implementation of |on|.
    private fallbackOn_ = (t:string, f:(m:any) => void) : void => {
      this.listeners_[t] = f;
    }

    // Shuts down the TCP server and peerconnection if they haven't already
    // shut down, fulfilling once both have terminated. Since neither
    // object's close() methods should ever reject, this should never reject.
    // TODO: close all sessions before fulfilling
    private stopResources_ = () : Promise<void> => {
      log.debug('freeing resources');
      // PeerConnection.close() returns void, implying that the shutdown is
      // effectively immediate.  However, we wrap it in a promise to ensure
      // that any exception is sent to the Promise.catch, rather than
      // propagating synchronously up the stack.
      return Promise.all(<Promise<any>[]>[
        new Promise((F, R) => { this.peerConnection_.close(); F(); }),
        this.tcpServer_.shutdown()
      ]).then((discard:any) => {});
    }

    // Invoked when a SOCKS client establishes a connection with the TCP server.
    // Note that Session closes the TCP connection and datachannel on any error.
    private makeTcpToRtcSession_ = (tcpConnection:tcp.Connection) : void => {
      this.pool_.openDataChannel()
          .then((channel:peerconnection.DataChannel) => {
        var channelLabel = channel.getLabel();
        log.info('associating channel %1 with new SOCKS client', channelLabel);
        var session = new Session();
        session.start(
            tcpConnection,
            channel,
            this.bytesSentToPeer_,
            this.bytesReceivedFromPeer_)
        .catch((e:Error) => {
          log.warn('session %1 failed to connect to remote endpoint: %2', [
              channelLabel, e.message]);
        });

        session.onceStopped.then(() => {
          log.info('discarded session %1', channelLabel);
        }, (e:Error) => {
          log.error('session %1 terminated with error: %2', [
              channelLabel, e.message]);
        });
      }, (e:Error) => {
        log.error('failed to open channel for new SOCKS client: %1 ',
            e.message);
        tcpConnection.send(socks.composeResponseBuffer({
          reply: socks.Reply.FAILURE
        }));
      });
    }

    public handleSignalFromPeer = (signal:Object) : void => {
      this.peerConnection_.handleSignalMessage(signal);
    }

    public toString = () : string => {
      var ret :string;
      var sessionsAsStrings :string[] = [];
      var label :string;
      ret = JSON.stringify({ tcpServer_: this.tcpServer_.toString() });
      return ret;
    }
  }  // class SocksToRtc


  // A Socks sesson links a Tcp connection to a particular data channel on the
  // peer connection. CONSIDER: when we have a lightweight webrtc provider, we
  // can use the DataChannel class directly here instead of the awkward pairing
  // of peerConnection with chanelLabel.
  export class Session {
    private tcpConnection_ :tcp.Connection;
    private dataChannel_ :peerconnection.DataChannel;
    private bytesSentToPeer_ :handler.Queue<number,void>;
    private bytesReceivedFromPeer_ :handler.Queue<number,void>;

    // Fulfills once the SOCKS negotiation process has successfully completed.
    // Rejects if negotiation fails for any reason.
    public onceReady :Promise<void>;

    // Call this to initiate shutdown.
    private fulfillStopping_ :() => void;
    private onceStopping_ = new Promise((F, R) => {
      this.fulfillStopping_ = F;
    });

    // Fulfills once the SOCKS session has terminated and the TCP connection
    // and datachannel have been shutdown.
    // This can happen in response to:
    //  - startup (negotiation) failure
    //  - TCP connection or datachannel termination
    //  - manual invocation of stop()
    // Should never reject.
    public onceStopped :Promise<void>;

    // The supplied TCP connection and datachannel must already be
    // successfully established.
    // Returns onceReady.
    public start = (
        tcpConnection:tcp.Connection,
        dataChannel:peerconnection.DataChannel,
        bytesSentToPeer:handler.Queue<number,void>,
        bytesReceivedFromPeer:handler.Queue<number,void>)
        : Promise<void> => {
      this.tcpConnection_ = tcpConnection;
      this.dataChannel_ = dataChannel;
      this.bytesSentToPeer_ = bytesSentToPeer;
      this.bytesReceivedFromPeer_ = bytesReceivedFromPeer;

      // The session is ready once we've completed both
      // auth and request handshakes.
      this.onceReady = this.doAuthHandshake_().then(
          this.doRequestHandshake_).then((response:socks.Response) => {
        if (response.reply !== socks.Reply.SUCCEEDED) {
          throw new Error('handshake failed with reply code ' +
              socks.Reply[response.reply]);
        }
        log.info('%1: connected to remote host', [this.longId()]);
        log.debug('%1: remote peer bound address: %2', [
            this.longId(),
            JSON.stringify(response.endpoint)]);
      });

      // Once the handshakes have completed, start forwarding data between the
      // socket and channel and listen for socket and channel termination.
      // If handshake fails, shutdown.
      this.onceReady.then(this.linkSocketAndChannel_, this.fulfillStopping_);

      // Shutdown once the data channel terminates.
      this.dataChannel_.onceClosed.then(() => {
        if (this.dataChannel_.dataFromPeerQueue.getLength() > 0) {
          log.warn('%1: channel closed with %2 unprocessed incoming messages',
              this.longId(), this.dataChannel_.dataFromPeerQueue.getLength());
        } else {
          log.info('%1: channel closed', this.longId());
        }
        this.fulfillStopping_();
      });

      // Once shutdown has been requested, free resources.
      // TODO: This promise is only used for logging, so we should probably
      // remove it, or at least make it private.
      this.onceStopped = this.onceStopping_.then(this.stopResources_);

      return this.onceReady;
    }

    public longId = () : string => {
      return 'session ' + this.channelLabel() + ' (socket ' +
          this.tcpConnection_.connectionId + ' ' +
          (this.tcpConnection_.isClosed() ? 'closed' : 'open') + ')';
    }

    // Initiates shutdown of the TCP server and peerconnection.
    // Returns onceStopped.
    public stop = () : Promise<void> => {
      log.debug('%1: stop requested', [this.longId()]);
      this.fulfillStopping_();
      return this.onceStopped;
    }

    // Closes the TCP connection and datachannel if they haven't already
    // closed, fulfilling once both have closed. Since neither object's
    // close() methods should ever reject, this should never reject.
    private stopResources_ = () : Promise<void> => {
      log.debug('%1: freeing resources', [this.longId()]);
      // DataChannel.close() returns void, implying that it is
      // effectively immediate.  However, we wrap it in a promise to ensure
      // that any exception is sent to the Promise.catch, rather than
      // propagating synchronously up the stack.
      return Promise.all(<Promise<any>[]>[
        new Promise((F, R) => { this.dataChannel_.close(); F(); }),
        this.tcpConnection_.close()
      ]).then((discard:any) => {});
    }

    public channelLabel = () : string => {
      return this.dataChannel_.getLabel();
    }

    public toString = () : string => {
      return JSON.stringify({
        channelLabel_: this.channelLabel(),
        tcpConnection: this.tcpConnection_.toString()
      });
    }

    // Receive a socks connection and send the initial Auth messages.
    // Assumes: no packet fragmentation.
    // TODO: send failure to client if auth fails
    // TODO: handle packet fragmentation:
    //   https://github.com/uProxy/uproxy/issues/323
    // TODO: Needs unit tests badly since it's mocked by several other tests.
    private doAuthHandshake_ = ()
        : Promise<void> => {
      return this.tcpConnection_.receiveNext()
        .then(socks.interpretAuthHandshakeBuffer)
        .then((auths:socks.Auth[]) => {
          this.tcpConnection_.send(
              socks.composeAuthResponse(socks.Auth.NOAUTH));
        });
    }

    // Handles the SOCKS handshake, fulfilling with the socks.Response instance
    // sent to the SOCKS client iff all the following steps succeed:
    //  - reads the next packet from the socket
    //  - parses this packet as a socks.Request instance
    //  - pauses the socket to avoid receiving data before it can be forwarded
    //  - forwards this to RtcToNet
    //  - receives the next message from the channel
    //  - parses this message as a socks.Response instance
    //  - forwards the socks.Response to the SOCKS client
    // If a response is not received from RtcToNet or any other error
    // occurs then we send a generic FAILURE response back to the SOCKS
    // client before rejecting.
    // TODO: Needs unit tests badly since it's mocked by several other tests.
    private doRequestHandshake_ = () : Promise<socks.Response> => {
      return this.tcpConnection_.receiveNext()
        .then(socks.interpretRequestBuffer)
        .then((request:socks.Request) => {
          // The domain name is very sensitive, so we keep it out of the
          // info-level logs, which may be uploaded.
          log.debug('%1: received endpoint from SOCKS client: %2', [
              this.longId(), JSON.stringify(request.endpoint)]);
          this.tcpConnection_.pause();
          return this.dataChannel_.send({ str: JSON.stringify(request) });
        })
        .then(() => {
          // Equivalent to channel.receiveNext(), if it existed.
          return new Promise((F, R) => {
            this.dataChannel_.dataFromPeerQueue.setSyncNextHandler(F).catch(R);
          });
        })
        .then((data:peerconnection.Data) => {
          if (!data.str) {
            throw new Error('received non-string data from peer ' +
              'during handshake: ' + JSON.stringify(data));
          }
          try {
            var response :socks.Response = JSON.parse(data.str);
            if (!socks.isValidResponse(response)) {
              throw new Error('invalid response received from peer ' +
                  'during handshake: ' + data.str);
            }
            return response;
          } catch (e) {
            throw new Error('could not parse response from peer: ' + e.message);
          }
        })
        .catch((e:Error) => {
          log.debug('%1: unexpected failure during handshake, ' +
              'returning generic FAILURE to SOCKS client: %2', [
              this.longId(),
              e.message]);
          return {
            reply: socks.Reply.FAILURE
          };
        })
        .then((response:socks.Response) => {
          return this.tcpConnection_.send(socks.composeResponseBuffer(
              response)).then((discard:any) => { return response; });
        });
    }

    // Sends a packet over the data channel.
    // Invoked when a packet is received over the TCP socket.
    private sendOnChannel_ = (data:ArrayBuffer) : void => {
      this.dataChannel_.send({buffer: data});
    }

    // Sends a packet over the TCP socket.
    // Invoked when a packet is received over the data channel.
    private sendOnSocket_ = (data:peerconnection.Data) : void => {
      if (!data.buffer) {
        throw new Error('received non-buffer data from datachannel');
      }
      this.bytesReceivedFromPeer_.handle(data.buffer.byteLength);
      this.tcpConnection_.send(data.buffer);
    }

    // Configures forwarding of data from the TCP socket over the data channel
    // and vice versa. Should only be called once both socket and channel have
    // been successfully established.
    private linkSocketAndChannel_ = () : void => {
      log.info('%1: linking socket and channel', this.longId());
      var socketReader = (data:ArrayBuffer) => {
        this.sendOnChannel_(data);
        this.bytesSentToPeer_.handle(data.byteLength);
      };
      this.tcpConnection_.dataFromSocketQueue.setSyncHandler(socketReader);

      // Shutdown the session once the TCP connection terminates.
      // This should be safe now because
      // (1) this.tcpConnection_.dataFromPeerQueue has now been emptied into
      // this.dataChannel_.send() and (2) this.dataChannel_.close() should delay
      // closing until all pending messages have been sent.
      this.tcpConnection_.onceClosed.then((kind:tcp.SocketCloseKind) => {
        log.info('%1: socket closed (%2)',
            this.longId(),
            tcp.SocketCloseKind[kind]);
        this.fulfillStopping_();
      });

      var channelReader = (data:peerconnection.Data) : void => {
        this.sendOnSocket_(data);
      };
      this.dataChannel_.dataFromPeerQueue.setSyncHandler(channelReader);

      // The TCP connection starts in the paused state.  However, in extreme
      // cases, enough data can arrive before the pause takes effect to put
      // the data channel into overflow.  In that case, the socket will
      // eventually be resumed by the overflow listener below.
      if (!this.dataChannel_.isInOverflow()) {
        this.tcpConnection_.resume();
      }

      this.dataChannel_.setOverflowListener((overflow:boolean) => {
        if (this.tcpConnection_.isClosed()) {
          return;
        }

        if (overflow) {
          this.tcpConnection_.pause();
          log.debug('%1: Hit overflow, pausing socket', this.longId());
        } else {
          this.tcpConnection_.resume();
          log.debug('%1: Exited  overflow, resuming socket', this.longId());
        }
      });
    }
  }  // Session

}  // module SocksToRtc

export = SocksToRtc;
