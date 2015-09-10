/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/ipaddrjs/ipaddrjs.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import candidate = require('./candidate');
import churn_pipe_types = require('../churn-pipe/freedom-module.interface');
import churn_types = require('./churn.types');
import handler = require('../handler/queue');
import ipaddr = require('ipaddr.js');
import logging = require('../logging/logging');
import net = require('../net/net.types');
import peerconnection = require('../webrtc/peerconnection');
import random = require('../crypto/random');
import sequence = require('../fancy-transformers/byteSequenceShaper');
import signals = require('../webrtc/signals');

import ChurnSignallingMessage = churn_types.ChurnSignallingMessage;
import ChurnPipe = churn_pipe_types.freedom_ChurnPipe;
import MirrorMapping = churn_pipe_types.MirrorMapping;

import Candidate = candidate.Candidate;
import RTCIceCandidate = freedom.RTCPeerConnection.RTCIceCandidate;

var log :logging.Log = new logging.Log('churn');

export var filterCandidatesFromSdp = (sdp:string) : string => {
  return sdp.split('\n').filter((s) => {
    return s.indexOf('a=candidate') !== 0;
  }).join('\n');
}


  export interface NatPair {
    internal: net.Endpoint;
    external: net.Endpoint;
  }

  // This function implements a heuristic to select the single candidate
  // that is most likely to work for this connection.  The heuristic
  // expresses a preference ordering:
  // Most preferred: public IP address bound as a host candidate
  //  - rare outside of servers, but offers the very best connectivity
  // Next best: server-reflexive IP address
  //  - most common
  // Worst: private IP address in a host candidate
  //  - indicates that STUN has failed.  Connection is still possible
  //    if the other side is directly routable.
  // If none of these are present, the function will throw an exception.
  // This function is used only for legacy compatibility with older
  // CHURN endpoints.
  // TODO: remove this function once those CHURN endpoints are deprecated.
  export var selectBestPublicAddress = (candidates:Candidate[])
      : NatPair => {
    var score = (c:Candidate) : boolean[] => {
      var addr = ipaddr.process(c.ip);
      // List of selection criteria, from most important to least.
      return [
        c.protocol === 'udp',
        addr.kind() === 'ipv4',
        c.type === 'host' && addr.range() === 'unicast',
        c.type === 'srflx'
      ];
    };
    candidates.sort((a, b) : number => {
      var scoreA = score(a), scoreB = score(b);
      for (var i = 0; i < scoreA.length; ++i) {
        if (scoreA[i] && !scoreB[i]) {
          return -1;
        } else if (scoreB[i] && !scoreA[i]) {
          return 1;
        }
      }
      return 0;
    });

    var best = candidates[0];
    if (best.type === 'srflx') {
      return {
        internal: {
          address: best.relatedAddress,
          port: best.relatedPort
        },
        external: {
          address: best.ip,
          port: best.port
        }
      };
    } else if (best.type === 'host') {
      var endpoint = {
          address: best.ip,
          port: best.port
      };
      return {
        internal: endpoint,
        external: endpoint
      };
    }
    throw new Error('no srflx or host candidate found');
  };

  // Generates a key suitable for use with CaesarCipher, viz. 1-255.
  var generateCaesarKey_ = (): number => {
    try {
      return (random.randomUint32() % 255) + 1;
    } catch (e) {
      // https://github.com/uProxy/uproxy/issues/1593
      log.warn('crypto unavailable, using Math.random');
      return Math.floor((Math.random() * 255)) + 1;
    }
  }

  /**
   * A PeerConnection implementation that establishes obfuscated connections.
   *
   * DTLS packets are intercepted by pointing WebRTC at a local "forwarding"
   * port; connectivity to the remote host is achieved with the help of
   * the browser's STUN implementation.
   *
   * This is mostly a thin wrapper over PeerConnection except for the
   * magic required during setup.
   *
   * Right now, CaesarCipher is used with a key which is randomly generated
   * each time a new connection is negotiated.
   */
  // TODO: The increasing number of calls gated on the probe connection
  //       strongly suggests that factoring out the NAT hole-punching code
  //       as suggested here would greatly help readability and
  //       maintainability:
  //         https://github.com/uProxy/uproxy/issues/585
  export class Connection implements peerconnection.PeerConnection<ChurnSignallingMessage> {

    // Maximum time to spend gathering ICE candidates.
    // We cap this so that slow STUN servers, in the absence
    // of trickle ICE, don't make the user wait unnecessarily.
    private static PROBE_TIMEOUT_MS_ = 3000;

    public peerOpenedChannelQueue :handler.QueueHandler<peerconnection.DataChannel, void>;
    public signalForPeerQueue :handler.Queue<ChurnSignallingMessage, void>;
    public peerName :string;

    public onceConnected :Promise<void>;
    public onceClosed :Promise<void>;

    // A short-lived connection used to determine network addresses on which
    // we might be able to communicate with the remote host.
    private probeConnection_
        :peerconnection.PeerConnection<signals.Message>;

    // The obfuscated connection.
    private obfuscatedConnection_
        :peerconnection.PeerConnection<signals.Message>;

    // All candidates received from the remote peer, organized by their
    // connection address.
    private remoteCandidates_ :{
      [address:string]: {
        [port:number]: Candidate
      }
    } = {};

    // Fulfills once we know the obfuscation key for caesar cipher.
    private haveCaesarKey_ :(key:number) => void;
    private onceHaveCaesarKey_ = new Promise((F, R) => {
      this.haveCaesarKey_ = F;
    });

    private pipe_ :ChurnPipe;
    private havePipe_ :() => void;
    // |onceHavePipe_| resolves once the churn pipe has been created and the
    // probe candidates have been added to the pipe.
    private onceHavePipe_ = new Promise((F,R) => {
      this.havePipe_ = F;
    });

    // Fulfills once the probe connection has finished gathering candidates.
    private probingComplete_ :() => void;
    private onceProbingComplete_ = new Promise((F,R) => {
      this.probingComplete_ = F;
    });

    private static internalConnectionId_ = 0;

    constructor(probeRtcPc:freedom.RTCPeerConnection.RTCPeerConnection,
                peerName?:string,
                private skipPublicEndpoint_?:boolean,
                private portControl_?:freedom.PortControl.PortControl) {
      this.peerName = peerName || 'churn-connection-' +
          (++Connection.internalConnectionId_);

      this.signalForPeerQueue = new handler.Queue<ChurnSignallingMessage,void>();

      this.configureObfuscatedConnection_();
      // When the probe connection is complete, it will trigger the
      // creation of the churn pipe.
      this.configureProbeConnection_(probeRtcPc);

      // Forward onceXxx promises.
      this.onceConnected = this.obfuscatedConnection_.onceConnected;
      this.onceClosed = this.obfuscatedConnection_.onceClosed;

      // Debugging.
      this.onceHaveCaesarKey_.then((key: number) => {
        log.info('%1: caesar key is %2', this.peerName, key);
      });
    }

    private configureProbeConnection_ = (
        freedomPc:freedom.RTCPeerConnection.RTCPeerConnection) => {
      var probePeerName = this.peerName + '-probe';

      // The list of all candidates returned by the probe connection.
      var candidates :Candidate[] = [];

      this.probeConnection_ = new peerconnection.PeerConnectionClass(
          freedomPc, probePeerName);
      this.probeConnection_.signalForPeerQueue.setSyncHandler(
          (message:signals.Message) => {
        if (message.type === signals.Type.CANDIDATE) {
          var c = Candidate.fromRTCIceCandidate(message.candidate);
          if (c.protocol === 'udp') {
            // Try to make port mappings for all srflx candidates
            var MAP_LIFETIME = 24 * 60 * 60;  // 24 hours in seconds
            if (c.type === 'srflx') {
              if (this.portControl_ === undefined) {
                log.debug('Port control not available in churn');
              } else {
                this.portControl_.addMapping(c.relatedPort, c.port, MAP_LIFETIME).
                  then((mapping:freedom.PortControl.Mapping) => {
                    if (mapping.externalPort === -1) {
                      log.debug("addMapping() failed. Mapping object: ",
                                mapping);
                    } else {
                      log.debug("addMapping() success: ", mapping);
                    }
                });
              }
            }

            // It's immediately safe to send each candidate to the remote peer,
            // because the remote peer will retry for several seconds, and the
            // probe connection will not respond to any pings because it doesn't
            // have a remote description.
            this.signalForPeerQueue.handle({
              webrtcMessage: message
            });

            // We cannot rebind any local ports until the probe connection has
            // released them, so we have to store them and wait until probing is
            // complete.
            candidates.push(c);
          }
        } else if (message.type === signals.Type.NO_MORE_CANDIDATES) {
          this.probingComplete_();
        }
      });

      setTimeout(() => {
        log.warn('%1: probing timed out, closing probe connection',
            this.peerName);
        this.probingComplete_();
      }, Connection.PROBE_TIMEOUT_MS_);

      this.onceProbingComplete_.then(() => {
        this.probeConnection_.close().then(() => {
          return this.onceHaveCaesarKey_;
        }).then(this.configurePipe_).then(() => {
          this.processProbeCandidates_(candidates);
          this.havePipe_();
        });
      });

      this.probeConnection_.negotiateConnection();
    }

    private processProbeCandidates_ = (candidates:Candidate[]) => {
      candidates.forEach((c) => {
        this.pipe_.bindLocal(c.getLocalEndpoint());
      });

      // For backwards compatibility.
      if (!this.skipPublicEndpoint_) {
        var bestEndpointPair = selectBestPublicAddress(candidates);
        this.signalForPeerQueue.handle({
          publicEndpoint: bestEndpointPair.external
        });
      }
    }

    private configurePipe_ = (key:number) : void => {
      this.pipe_ = freedom['churnPipe'](this.peerName);
      this.pipe_.on('mappingAdded', this.onMappingAdded_);

      this.pipe_.setTransformer('caesar',
          new Uint8Array([key]).buffer,
          '{}');

      // Uncomment this to enable AES-based obfuscation.
      // this.pipe_.setTransformer('encryptionShaper',
      //     undefined,
      //     JSON.stringify({
      //       'key': '0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0'
      //     }));

      // Uncomment this to enable byte sequence injection obfuscation.
      // this.pipe_.setTransformer('byteSequenceShaper', undefined,
      //  JSON.stringify(this.makeSampleSequences_()));
    }

    private makeSampleSequences_ = () :sequence.SequenceConfig => {
      var buffer=arraybuffers.stringToArrayBuffer("OH HELLO");
      var hex=arraybuffers.arrayBufferToHexString(buffer);
      var sequence={index: 0, offset: 0,
        sequence: hex,
        length: 256};

      return {addSequences: [sequence], removeSequences: [sequence]};
    }

    private addRemoteCandidate_ = (iceCandidate:RTCIceCandidate) => {
      var c = Candidate.fromRTCIceCandidate(iceCandidate);
      var remoteEndpoint = {
        address: c.ip,
        port: c.port
      };
      if (!this.remoteCandidates_[remoteEndpoint.address]) {
        this.remoteCandidates_[remoteEndpoint.address] = {};
      }
      this.remoteCandidates_[remoteEndpoint.address][remoteEndpoint.port] = c;
      this.onceHavePipe_.then(() => {
        this.pipe_.bindRemote(remoteEndpoint).catch(log.error);
      });
    }

    // Returns the remote side Candidate that advertises this endpoint.
    // This is used to recover the entire candidate when a new mapping is
    // added, in order to convey the right candidate metadata (priority,
    // generation, etc.) to the obfuscated connection.
    private getRemoteCandidate_ = (endpoint:net.Endpoint) : Candidate => {
      return this.remoteCandidates_[endpoint.address] &&
          this.remoteCandidates_[endpoint.address][endpoint.port];
    }

    // A new mirror socket has been created.  (Each call to churn-pipe's
    // bindLocal and bindRemote methods may trigger the creation of one
    // or more mirror sockets.)  Wrap it into a virtual remote ICE candidate
    // and signal it to the obfuscated connection.
    private onMappingAdded_ = (mapping:MirrorMapping) => {
      var original = this.getRemoteCandidate_(mapping.remote);
      if (original) {
        var copy = original.clone();
        copy.ip = mapping.local.address;
        copy.port = mapping.local.port;
        this.obfuscatedConnection_.handleSignalMessage({
          type: signals.Type.CANDIDATE,
          candidate: copy.toRTCIceCandidate()
        });
      } else {
        log.error('Got a mapping for a nonexistent candidate');
      }
    }

    private configureObfuscatedConnection_ = () => {
      // We use an empty configuration to ensure that no STUN servers are pinged.
      var obfConfig :freedom.RTCPeerConnection.RTCConfiguration = {
        iceServers: []
      };
      var obfPeerName = this.peerName + '-obfuscated';
      var freedomPc = freedom['core.rtcpeerconnection'](obfConfig);
      this.obfuscatedConnection_ = new peerconnection.PeerConnectionClass(
          freedomPc, obfPeerName);
      this.obfuscatedConnection_.signalForPeerQueue.setSyncHandler(
          (message:signals.Message) => {
        if (message.type === signals.Type.OFFER ||
            message.type === signals.Type.ANSWER) {
          // Super-paranoid check: remove candidates from SDP messages.
          // This can happen if a connection is re-negotiated.
          // TODO: We can safely remove this once we can reliably interrogate
          //       peerconnection endpoints.
          message.description.sdp =
              filterCandidatesFromSdp(message.description.sdp);
          var churnSignal :ChurnSignallingMessage = {
            webrtcMessage: message
          };
          this.signalForPeerQueue.handle(churnSignal);
        } else if (message.type === signals.Type.CANDIDATE) {
          // This will tell us on which port webrtc is operating.
          // There's no need to send this to the peer because it can
          // trivially formulate a candidate line with the address of
          // its pipe.
          try {
            if (!message.candidate || !message.candidate.candidate) {
              throw new Error('no candidate line');
            }
            var c = Candidate.fromRTCIceCandidate(message.candidate);
            if (c.protocol !== 'udp') {
              throw new Error('Wrong transport: ' + c.protocol);
            }
            var browserEndpoint = c.getLocalEndpoint();
            this.onceHavePipe_.then(() => {
              this.pipe_.addBrowserEndpoint(browserEndpoint);
            });
          } catch (e) {
            log.debug('%1: ignoring candidate line %2: %3',
                this.peerName,
                JSON.stringify(message),
                e.message);
          }
        } else if (message.type === signals.Type.NO_MORE_CANDIDATES) {
          // churn itself doesn't need this but it serves as an
          // indication to features such as copy/paste that signalling
          // is finished.
          this.signalForPeerQueue.handle({
            webrtcMessage: message
          });
        }
      });
      this.peerOpenedChannelQueue =
          this.obfuscatedConnection_.peerOpenedChannelQueue;
    }

    public negotiateConnection = () : Promise<void> => {
      // Generate a key and send it to the remote party.
      // Once they've received it, they'll be able to establish
      // a matching pipe.
      var key = generateCaesarKey_();
      this.haveCaesarKey_(key);
      this.signalForPeerQueue.handle({
        caesar: key
      });
      return this.obfuscatedConnection_.negotiateConnection();
    }

    private static rtcIceCandidateFromPublicEndpoint_ =
        (endpoint:net.Endpoint) : RTCIceCandidate => {
      var c = Candidate.fromRTCIceCandidate({
        candidate: 'candidate:0 1 UDP 2130379007 0.0.0.0 0 typ host',
        sdpMid: '',
        sdpMLineIndex: 0
      });
      c.ip = endpoint.address;
      c.port = endpoint.port;
      return c.toRTCIceCandidate();
    }

    // Forward the message to the relevant stage: churn-pipe or obfuscated.
    // In the case of obfuscated signalling channel messages, we inject our
    // local forwarding socket's endpoint.
    public handleSignalMessage = (
        churnMessage:ChurnSignallingMessage) : void => {
      if (churnMessage.publicEndpoint !== undefined) {
        var fakeRTCIceCandidate = Connection.rtcIceCandidateFromPublicEndpoint_(
            churnMessage.publicEndpoint);
        this.addRemoteCandidate_(fakeRTCIceCandidate);
      }
      if (churnMessage.caesar !== undefined) {
        this.haveCaesarKey_(churnMessage.caesar);
      }
      if (churnMessage.webrtcMessage) {
        var message = churnMessage.webrtcMessage;
        if (message.type == signals.Type.OFFER ||
            message.type == signals.Type.ANSWER) {
          // Do not forward the signalling message until the probe connection
          // has been torn down. This is important because Firefox will give
          // up if no candidates are received within five seconds of having
          // received the offer and this can easily happen if candidate
          // gathering is slow due to slow STUN servers.
          this.onceHavePipe_.then(() => {
            // Remove candidates from the SDP.  This is redundant, but ensures
            // that a bug in the remote client won't cause us to send
            // unobfuscated traffic.
            message.description.sdp = filterCandidatesFromSdp(
              message.description.sdp);
            this.obfuscatedConnection_.handleSignalMessage(message);
          });
        } else if (message.type === signals.Type.CANDIDATE) {
          this.addRemoteCandidate_(message.candidate);
        }
      }
    }

    public openDataChannel = (channelLabel:string,
        options?:freedom.RTCPeerConnection.RTCDataChannelInit)
        : Promise<peerconnection.DataChannel> => {
          return this.obfuscatedConnection_.openDataChannel(channelLabel,
              options);
    }

    public close = () : Promise<void> => {
      return this.obfuscatedConnection_.close();
    }

    public toString = () : string => {
      return this.obfuscatedConnection_.toString();
    };
  }
