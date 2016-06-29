// Server which handles SOCKS connections over WebRTC datachannels and send them
// out to the internet and sending back over WebRTC the responses.

/// <reference path='../../../../third_party/typings/browser.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import handler = require('../handler/queue');
import ipaddr = require('ipaddr.js');
import logging = require('../logging/logging');
import net = require('../net/net.types');
import peerconnection = require('../webrtc/peerconnection');
import socks = require('../socks-common/socks-headers');
import tcp = require('../net/tcp');

import Pool = require('../pool/pool');
import ProxyConfig = require('./proxyconfig');

// module RtcToNet {

  var log :logging.Log = new logging.Log('RtcToNet');
  var usingTor :boolean = true;

  export interface SessionSnapshot {
    name :string;
    // Time in seconds, with fractional parts, of when the snapshot
    // was taken.  Epoch is start of this web-worker.  This is the
    // result of calling performance.now() -
    // https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
    timestamp: number;
    channel_sent: number;
    channel_received: number;
    channel_buffered: number;
    channel_js_buffered: number;
    channel_queue_size: number;
    channel_queue_handling: boolean;
    socket_sent: number;
    socket_received: number;
    socket_queue_size: number;
    socket_queue_handling: boolean;
  }

  export interface RtcToNetSnapshot {
    sessions :SessionSnapshot[];
  }

  // The |RtcToNet| class holds a peer-connection and all its associated
  // proxied connections.
  // TODO: Extract common code for this and SocksToRtc:
  //         https://github.com/uProxy/uproxy/issues/977
  export class RtcToNet {
    // Time between outputting snapshots.
    private static SNAPSHOTTING_INTERVAL_MS = 5000;

    // Limit the number of live sessions that each user can have.
    // Public for tests.
    public static SESSION_LIMIT = 10000;

    // Number of live sessions by user, if greater than zero.
    private static numSessions_ : { [userId:string] :number } = {};

    // Returns true if the addition was successful.
    private static addUserSession_ = (userId:string) : boolean => {
      if (!userId) {
        return true;
      }

      if (!(userId in RtcToNet.numSessions_)) {
        RtcToNet.numSessions_[userId] = 1;
        return true;
      }

      if (RtcToNet.numSessions_[userId] < RtcToNet.SESSION_LIMIT) {
        ++RtcToNet.numSessions_[userId];
        return true;
      }

      return false;
    }

    private static removeUserSession_ = (userId:string) : void => {
      if (!userId) {
        return;
      }

      --RtcToNet.numSessions_[userId];
      if (RtcToNet.numSessions_[userId] === 0) {
        delete RtcToNet.numSessions_[userId];
      }
    }

    // Configuration for the proxy endpoint. Note: all sessions share the same
    // (externally provided) proxyconfig.
    public proxyConfig :ProxyConfig;

    // Message handler queues to/from the peer.
    public signalsForPeer :handler.QueueHandler<Object, void>;

    // The two Queues below only count bytes transferred between the SOCKS
    // client and the remote host(s) the client wants to connect to. WebRTC
    // overhead (DTLS headers, ICE initiation, etc.) is not included (because
    // WebRTC does not provide easy access to that data) nor is SOCKS
    // protocol-related data (because it's sent via string messages).
    // All Sessions created in one instance of RtcToNet will share and
    // push numbers to the same queues (belonging to that instance of RtcToNet).
    // Queue of the number of bytes received from the peer. Handler is typically
    // defined in the class that creates an instance of RtcToNet.
    public bytesReceivedFromPeer :handler.Queue<number, void> =
        new handler.Queue<number, void>();

    // Queue of the number of bytes sent to the peer. Handler is typically
    // defined in the class that creates an instance of RtcToNet.
    public bytesSentToPeer :handler.Queue<number, void> =
        new handler.Queue<number, void>();

    // Fulfills once the module is ready to allocate sockets.
    // Rejects if a peerconnection could not be made for any reason.
    public onceReady :Promise<void>;

    // Call this to initiate shutdown.
    private fulfillStopping_ :() => void;
    private onceStopping_ = new Promise((F, R) => {
      this.fulfillStopping_ = F;
    });

    // Fulfills once the module has terminated and the peerconnection has
    // been shutdown.
    // This can happen in response to:
    //  - startup failure
    //  - peerconnection termination
    //  - manual invocation of stop()
    // Should never reject.
    public onceStopped :Promise<void>;

    // The connection to the peer that is acting as a proxy client. Once
    // assigned, is never un-assigned. Use in this class to tell if started.
    private peerConnection_ :peerconnection.PeerConnection<Object>;

    // This pool manages the data channels for the PeerConnection.
    private pool_ :Pool;

    // The |sessions_| map goes from WebRTC data-channel labels to the Session.
    // Most of the wiring to manage this relationship happens via promises. We
    // need this only for data being received from a peer-connection data
    // channel get raised with data channel label. TODO:
    // https://github.com/uProxy/uproxy/issues/315 when closed allows
    // DataChannel and PeerConnection to be used directly and not via a freedom
    // interface. Then all work can be done by promise binding and this can be
    // removed.
    private sessions_ :{ [channelLabel:string] : Session } = {};

    // |userId_| is used to enforce user-wide resource limits.
    public constructor(private userId_?:string) {}

    // Starts with the supplied peerconnection.
    // Returns this.onceReady.
    public start = (
        proxyConfig:ProxyConfig,
        peerconnection:peerconnection.PeerConnection<Object>)
        : Promise<void> => {
      if (this.peerConnection_) {
        throw new Error('already configured');
      }
      this.peerConnection_ = peerconnection;
      this.pool_ = new Pool(peerconnection, 'RtcToNet');
      this.proxyConfig = proxyConfig;

      this.signalsForPeer = this.peerConnection_.signalForPeerQueue;
      this.pool_.peerOpenedChannelQueue.setSyncHandler(
          this.onPeerOpenedChannel_);

      // TODO: this.onceReady should reject if |this.onceStopping_|
      // fulfills first.  https://github.com/uProxy/uproxy/issues/760
      this.onceReady = this.peerConnection_.onceConnected.then(() => {});
      this.onceReady.catch(this.fulfillStopping_);
      this.peerConnection_.onceClosed
        .then(() => {
          log.debug('peerconnection terminated');
        }, (e:Error) => {
          log.error('peerconnection terminated with error: %1', [e.message]);
        })
        .then(this.fulfillStopping_, this.fulfillStopping_);
      this.onceStopped = this.onceStopping_.then(this.stopResources_);

      // Uncomment this to see instrumentation data in the console.
      //this.onceReady.then(this.initiateSnapshotting);

      return this.onceReady;
    }

    // Loops until onceStopped fulfills.
    public initiateSnapshotting = () => {
      var loop = true;
      this.onceStopped.then(() => {
        loop = false;
      });
      var writeSnapshot = () => {
        this.getSnapshot().then((snapshot:RtcToNetSnapshot) => {
          log.info('snapshot: %1', JSON.stringify(snapshot));
        });
        if (loop) {
          setTimeout(writeSnapshot, RtcToNet.SNAPSHOTTING_INTERVAL_MS);
        }
      };
      writeSnapshot();
    }

    // Snapshots the state of this RtcToNet instance.
    private getSnapshot = () : Promise<RtcToNetSnapshot> => {
      var promises :Promise<SessionSnapshot>[] = [];
      Object.keys(this.sessions_).forEach((key:string) => {
        promises.push(this.sessions_[key].getSnapshot())
      });
      return Promise.all(promises).then((sessionSnapshots:SessionSnapshot[]) => {
        return {
          sessions: sessionSnapshots
        };
      });
    }

    private onPeerOpenedChannel_ = (channel:peerconnection.DataChannel) => {
      var channelLabel = channel.getLabel();
      log.info('associating session %1 with new datachannel', [channelLabel]);

      if (!RtcToNet.addUserSession_(this.userId_)) {
        log.warn('User %1 hit overload; closing channel %2',
            this.userId_, channelLabel);
        channel.close();
        return;
      }

      var session = new Session(
          channel,
          this.proxyConfig,
          this.bytesReceivedFromPeer,
          this.bytesSentToPeer);
      this.sessions_[channelLabel] = session;
      session.start().catch((e:Error) => {
        log.warn('session %1 failed to connect to remote endpoint: %2', [
            channelLabel, e.message]);
      });

      var discard = () => {
        delete this.sessions_[channelLabel];
        RtcToNet.removeUserSession_(this.userId_);
        log.info('discarded session %1 (%2 remaining)', [
            channelLabel, Object.keys(this.sessions_).length]);
        };
      session.onceStopped().then(discard, (e:Error) => {
        log.error('session %1 terminated with error: %2', [
            channelLabel, e.message]);
        discard();
      });
    }

    // Initiates shutdown of the peerconnection.
    // Returns onceStopped.
    public stop = () : Promise<void> => {
      log.debug('stop requested');
      this.fulfillStopping_();
      return this.onceStopped;
    }

    // Shuts down the peerconnection, fulfilling once it has terminated.
    // Since its close() method should never throw, this should never reject.
    // TODO: close all sessions before fulfilling
    private stopResources_ = () : Promise<void> => {
      log.debug('freeing resources');
      // TODO(ldixon): explore why not not just return
      // this.peerConnection_.close(); call the PeerConnection's close and
      // return synchronously.
      return new Promise<void>((F, R) => {
        this.peerConnection_.close();
        F();
      });
    }

    public handleSignalFromPeer = (message:Object) :void => {
      return this.peerConnection_.handleSignalMessage(message);
    }

    public toString = () : string => {
      var ret :string;
      var sessionsAsStrings :string[] = [];
      var label :string;
      for (label in this.sessions_) {
        sessionsAsStrings.push(this.sessions_[label].longId());
      }
      ret = JSON.stringify({ sessions_: sessionsAsStrings });
      return ret;
    }

  }  // class RtcToNet


  // A Tcp connection and its data-channel on the peer connection.
  //
  // CONSIDER: when we have a lightweight webrtc provider, we can use the
  // DataChannel class directly here instead of the awkward pairing of
  // peerConnection with chanelLabel.
  //
  // CONSIDER: this and the socks-rtc session are similar: maybe abstract
  // common parts into a super-class this inherits from?
  export class Session {
    private tcpConnection_ :tcp.Connection;

    // Fulfills once a connection has been established with the remote peer.
    // Rejects if a connection cannot be made for any reason.
    public onceReady :Promise<void>;

    // Call this to initiate shutdown.
    private fulfillStopping_ :() => void;
    private onceStopping_ = new Promise((F, R) => {
      this.fulfillStopping_ = F;
    });

    // Fulfills once the session has terminated and the TCP connection
    // and datachannel have been shutdown.
    // This can happen in response to:
    //  - startup failure
    //  - TCP connection or datachannel termination
    //  - manual invocation of close()
    // Should never reject.
    private onceStopped_ :Promise<void>;
    public onceStopped = () :Promise<void> => { return this.onceStopped_; }

    // Getters.
    public channelLabel = () :string => { return this.dataChannel_.getLabel(); }

    private socketSentBytes_ :number = 0;
    private socketReceivedBytes_ :number = 0;
    private channelSentBytes_ :number = 0;
    private channelReceivedBytes_ :number = 0;

    // The supplied datachannel must already be successfully established.
    constructor(
        private dataChannel_:peerconnection.DataChannel,
        private proxyConfig_:ProxyConfig,
        private bytesReceivedFromPeer_:handler.QueueFeeder<number,void>,
        private bytesSentToPeer_:handler.QueueFeeder<number,void>) {}

    // Returns onceReady.
    public start = () : Promise<void> => {
      this.onceReady = this.receiveEndpointFromPeer_()
        .catch((e:Error) => {
          // TODO: Add a unit test for this case.
          this.replyToPeer_(socks.Reply.UNSUPPORTED_COMMAND);
          return Promise.reject(e);
        })
        .then(this.getTcpConnection_)
        .then(this.waitForTcpConnection_)
        .then(this.handleTcpConnection_);

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

      this.onceStopped_ = this.onceStopping_.then(this.stopResources_);

      return this.onceReady;
    }

    // Initiates shutdown of the TCP connection and peerconnection.
    // Returns onceStopped.
    public stop = () : Promise<void> => {
      log.debug('%1: stop requested', [this.longId()]);
      this.fulfillStopping_();
      return this.onceStopped_;
    }

    // Closes the TCP connection and datachannel if they haven't already
    // closed, fulfilling once both have closed. Since neither object's
    // close() methods should ever reject, this should never reject.
    private stopResources_ = () : Promise<void> => {
      log.info('%1: freeing resources', [this.longId()]);
      // DataChannel.close() returns void, implying that the shutdown is
      // effectively immediate.  However, we wrap it in a promise to ensure
      // that any exception is sent to the Promise.catch, rather than
      // propagating synchronously up the stack.
      var shutdownPromises :Promise<any>[] = [
        new Promise((F, R) => { this.dataChannel_.close(); F(); })
      ];
      if (this.tcpConnection_) {
        shutdownPromises.push(this.tcpConnection_.close());
      }
      return Promise.all(shutdownPromises).then((discard:any) => {});
    }

    // Fulfills with the endpoint requested by the SOCKS client.
    // Rejects if the received message is not for an endpoint
    // or if the received endpoint cannot be parsed.
    // TODO: needs tests (mocked by several tests)
    private receiveEndpointFromPeer_ = () : Promise<net.Endpoint> => {
      return new Promise((F,R) => {
        this.dataChannel_.dataFromPeerQueue
            .setSyncNextHandler((data:peerconnection.Data) => {
          if (!data.str) {
            R(new Error('received non-string data from peer: ' +
                JSON.stringify(data)));
            return;
          }

          var request :socks.Request;
          try { request = JSON.parse(data.str); }
          catch (e) {
            R(new Error('received malformed message during handshake: ' +
                data.str));
            return;
          }

          if (!socks.isValidRequest(request)) {
            R(new Error('received invalid request from peer: ' +
                JSON.stringify(data.str)));
            return;
          }
          if (request.command != socks.Command.TCP_CONNECT) {
            R(new Error('unexpected type for endpoint message'));
            return;
          }

          // The domain name is very sensitive, so we keep it out of the
          // info-level logs, which may be uploaded.
          log.debug('%1: received endpoint from peer: %2', [
              this.longId(), JSON.stringify(request.endpoint)]);
          F(request.endpoint);
          return;
        });
      });
    }

    private getTcpConnection_ = (endpoint:net.Endpoint) : [tcp.Connection, net.Endpoint] => {
      if (ipaddr.isValid(endpoint.address) &&
          !this.isAllowedAddress_(endpoint.address)) {
        this.replyToPeer_(socks.Reply.NOT_ALLOWED);
        throw new Error('tried to connect to disallowed address: ' +
                        endpoint.address);
      }
      if (usingTor) {
        // Return TCP connection to local Tor proxy
        // and endpoint of request to be forwarded
        var localTorEndpoint :net.Endpoint = {
          address: '127.0.0.1',
          port: 9050
        };
        log.info('%1: Connecting to the local tor proxy: %2', [this.longId(), localTorEndpoint]);
        return [new tcp.Connection({endpoint: localTorEndpoint}), endpoint];
      } else {
        // Return TCP connection to endpoint and endpoint (endpoint unused)
        return [new tcp.Connection({endpoint: endpoint}, true /* startPaused */), endpoint];
      }
    }

    // Wait for connection to complete
    private waitForTcpConnection_ = (connectionInfo :[tcp.Connection, net.Endpoint])
          :Promise<[tcp.ConnectionInfo, net.Endpoint]> => {
      this.tcpConnection_ = connectionInfo[0];
      var endpoint : net.Endpoint = connectionInfo[1];
      log.info('%1: Connection instantiated to local tor proxy: %2, Will attempt to connect to: %3', [this.longId(), this.tcpConnection_, endpoint]);

      // If using Tor, complete socks auth handshake
      if (usingTor) {
        var authRequest = socks.composeAuthHandshakeBuffer([socks.Auth.NOAUTH]);
        log.info('%1: Creating auth handshake: %2', [this.longId(), authRequest]);
        this.tcpConnection_.send(authRequest);
      }

      return this.tcpConnection_.onceConnected
        .catch((e:freedom.Error) => {
          log.info('%1: failed to connect to remote endpoint', [this.longId()]);
          this.replyToPeer_(this.getReplyFromError_(e));
          return Promise.reject(new Error(e.errcode));
        }).then((info:tcp.ConnectionInfo) : [tcp.ConnectionInfo, net.Endpoint] => {
            return [info, endpoint];
        });
    }

    // Retrieves reply from created TCP connection
    // If using Tor, request will be sent through socks
    private handleTcpConnection_ = (connectionInfo: [tcp.ConnectionInfo, net.Endpoint]) : Promise<void> => {
      var info :tcp.ConnectionInfo = connectionInfo[0];
      var endpoint :net.Endpoint = connectionInfo[1];
      log.info('%1: Connected to local tor proxy: %2', [this.longId(), info]);

      if (usingTor) {
        //Send request through Socks protocol
        //return this.connectThroughSocks_(endpoint).then(this.replyToPeer_);
        return this.connectThroughSocks_(endpoint);
      } else {
        // Receive and return reply to peer from destination
        log.info('%1: connected to remote endpoint', [this.longId()]);
        log.debug('%1: bound address: %2', [this.longId(),
            JSON.stringify(info.bound)]);
        var reply = this.getReplyFromInfo_(info);
        this.replyToPeer_(reply, info);
      }

    }

    // Completes socks authentication protocol
    private connectThroughSocks_ = (endpoint:net.Endpoint) : Promise<void> => {
      log.info('%1: Connecting through socks to: %2', [this.longId(), endpoint]);
      var firstBufferPromise :Promise<ArrayBuffer> = this.tcpConnection_.receiveNext();
      return firstBufferPromise
        .then((buffer:ArrayBuffer) :Promise<ArrayBuffer> => {
          var auth = socks.interpretAuthResponse(buffer);
          log.info('%1: Received auth handshake reply: %2', [this.longId(), auth]);
          if (auth != socks.Auth.NOAUTH) {
            throw new Error('SOCKS server returned unexpected AUTH response. Expected ' +
                            socks.Auth.NOAUTH + ' but got ' + auth);
          }
          var request :socks.Request = {
            command: socks.Command.TCP_CONNECT,
            endpoint: endpoint,
          };
          log.info('%1: Making socks request: %2', [this.longId(), request]);
          this.tcpConnection_.send(socks.composeRequestBuffer(request));
          return this.tcpConnection_.receiveNext();
        }).then((buffer:ArrayBuffer) : Promise<void> => {
          var response = socks.interpretResponseBuffer(buffer);
          log.info('%1: Received request response: %2', [this.longId(), response]);
          if (response.reply != socks.Reply.SUCCEEDED) {
            return Promise.reject(new Error('Socks connection to local Tor failed'));
          }
          //reply to peer
          this.replyToPeer_(response.reply);
          //return Promise.resolve(response.reply);
        });
    }

    // Fulfills once the connected endpoint has been returned to the SOCKS
    // client. Rejects if the endpoint cannot be sent to the SOCKS client.
    private replyToPeer_ = (reply:socks.Reply, info?:tcp.ConnectionInfo)
        : Promise<void> => {
      var response :socks.Response = {
        reply: reply,
        endpoint: info ? info.bound : {"address":"0.0.0.0","port":0} 
      };
      log.info('%1: Sending response to Peer: %2', [this.longId(), response]);
      return this.dataChannel_.send({
        str: JSON.stringify(response)
      }).then(() => {
        if (reply != socks.Reply.SUCCEEDED) {
          this.stop();
        }
      });
    }

    private getReplyFromInfo_ = (info:tcp.ConnectionInfo) : socks.Reply => {
      // TODO: This code should really return socks.Reply.NOT_ALLOWED,
      // but due to port-scanning concerns we return a generic error instead.
      // See https://github.com/uProxy/uproxy/issues/809
      return this.isAllowedAddress_(info.remote.address) ?
          socks.Reply.SUCCEEDED : socks.Reply.FAILURE;
    }

    private getReplyFromError_ = (e:freedom.Error) : socks.Reply => {
      var reply :socks.Reply = socks.Reply.FAILURE;
      if (e.errcode == 'TIMED_OUT') {
        reply = socks.Reply.TTL_EXPIRED;
      } else if (e.errcode == 'NETWORK_CHANGED') {
        reply = socks.Reply.NETWORK_UNREACHABLE;
      } else if (e.errcode == 'NAME_NOT_RESOLVED') {
        reply = socks.Reply.HOST_UNREACHABLE;
      } else if (e.errcode == 'CONNECTION_RESET' ||
                 e.errcode == 'CONNECTION_REFUSED') {
        // Due to port-scanning concerns, we return a generic error if the user
        // has blocked local network access and we are not sure if the requested
        // address might be on the local network.
        // See https://github.com/uProxy/uproxy/issues/809
        if (this.proxyConfig_.allowNonUnicast) {
          reply = socks.Reply.CONNECTION_REFUSED;
        }
      }
      // TODO: report ConnectionInfo in cases where a port was bound.
      // Blocked by https://github.com/uProxy/uproxy/issues/803
      return reply;
    }

    // Sends a packet over the data channel.
    // Invoked when a packet is received over the TCP socket.
    private sendOnChannel_ = (data:ArrayBuffer) : void => {
      this.socketReceivedBytes_ += data.byteLength;
      this.dataChannel_.send({buffer: data});
    }

    // Sends a packet over the TCP socket.
    // Invoked when a packet is received over the data channel.
    private sendOnSocket_ = (data:peerconnection.Data) : void => {
      if (!data.buffer) {
        throw new Error('received non-buffer data from datachannel');
      }
      this.bytesReceivedFromPeer_.handle(data.buffer.byteLength);
      this.channelReceivedBytes_ += data.buffer.byteLength;

      this.tcpConnection_.send(data.buffer);
    }

    // Configures forwarding of data from the TCP socket over the data channel
    // and vice versa. Should only be called once both socket and channel have
    // been successfully established.
    private linkSocketAndChannel_ = () : void => {
      log.info('%1: linking socket and channel', this.longId());
      var socketReader = (data:ArrayBuffer) => {
        log.info('%1: Data sent on channel: %2', [this.longId(), arraybuffers.arrayBufferToString(data)]);
        console.error(this.longId() + ': Data sent on channel: ' + arraybuffers.arrayBufferToString(data));
        this.sendOnChannel_(data);
        this.bytesSentToPeer_.handle(data.byteLength);
        this.channelSentBytes_ += data.byteLength;

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
        log.info('%1: Data sent on tcp channel: %2', [this.longId(), arraybuffers.arrayBufferToString(data.buffer)]);
        console.error(this.longId() + ': Data sent on tcp channel: ' + arraybuffers.arrayBufferToString(data.buffer));
        this.sendOnSocket_(data);
        this.socketSentBytes_ += data.buffer.byteLength;
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
      log.info('%1: Leaving linking socket and channel', [this.longId()]);
    }

    private isAllowedAddress_ = (addressString:string) : boolean => {
      // default is to disallow non-unicast addresses; i.e. only proxy for
      // public internet addresses.
      if (this.proxyConfig_.allowNonUnicast) {
        return true
      }

      // ipaddr.process automatically converts IPv4-mapped IPv6 addresses into
      // IPv4 Address objects.  This ensure that an attacker cannot reach a
      // restricted IPv4 endpoint that is identified by its IPv6-mapped address.
      try {
        var address = ipaddr.process(addressString);
        return address.range() == 'unicast';
      } catch (e) {
        // This likely indicates a malformed IP address, which will be logged by
        // the caller.
        return false;
      }
    }

    public getSnapshot = () : Promise<SessionSnapshot> => {
      return this.dataChannel_.getBrowserBufferedAmount()
          .then((bufferedAmount:number) => {
        var js_buffer = this.dataChannel_.getJavascriptBufferedAmount();
        return {
          name: this.channelLabel(),
          timestamp: performance.now(),
          channel_sent: this.channelSentBytes_,
          channel_received: this.channelReceivedBytes_,
          channel_buffered: bufferedAmount,
          channel_queue_size: this.dataChannel_.dataFromPeerQueue.getLength(),
          channel_queue_handling: this.dataChannel_.dataFromPeerQueue.isHandling(),
          channel_js_buffered: js_buffer,
          socket_sent: this.socketSentBytes_,
          socket_received: this.socketReceivedBytes_,
          socket_queue_size: this.tcpConnection_.dataFromSocketQueue.getLength(),
          socket_queue_handling: this.tcpConnection_.dataFromSocketQueue.isHandling()
        }
      });
    }

    public longId = () : string => {
      var s = 'session ' + this.channelLabel();
      if (this.tcpConnection_) {
        s += ' (tcp-socket: ' + this.tcpConnection_.connectionId + ' ' +
            (this.tcpConnection_.isClosed() ? 'closed' : 'open') + ')';
      }
      return s;
    }

    // For logging/debugging.
    public toString = () : string => {
      var tcpString = 'undefined';
      if (this.tcpConnection_) {
        tcpString = this.tcpConnection_.toString();
      }
      return JSON.stringify({
        channelLabel_: this.channelLabel(),
        tcpConnection: tcpString
      });
    }

    // Runs callback once the current event loop has run to completion.
    // Uses setTimeout in lieu of something like Node's process.nextTick:
    //   https://github.com/uProxy/uproxy/issues/967
    private static nextTick_ = (callback:Function) : void => {
      setTimeout(callback, 0);
    }
  }  // Session

//}  // module RtcToNet
//export = RtcToNet;
