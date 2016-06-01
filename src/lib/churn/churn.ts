/// <reference path='../../../../third_party/ipaddrjs/ipaddrjs.d.ts' />
/// <reference path='../../../../third_party/typings/browser.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import caesar = require('../transformers/caesar');
import candidate = require('./candidate');
import churn_pipe_types = require('../churn-pipe/freedom-module.interface');
import churn_types = require('./churn.types');
import handler = require('../handler/queue');
import ipaddr = require('ipaddr.js');
import logging = require('../logging/logging');
import net = require('../net/net.types');
import peerconnection = require('../webrtc/peerconnection');
import random = require('../crypto/random');
import signals = require('../webrtc/signals');

import ChurnSignallingMessage = churn_types.ChurnSignallingMessage;
import ChurnPipe = churn_pipe_types.freedom_ChurnPipe;
import MirrorMapping = churn_pipe_types.MirrorMapping;
import TransformerConfig = churn_types.TransformerConfig;

import Candidate = candidate.Candidate;
import RTCIceCandidate = freedom.RTCPeerConnection.RTCIceCandidate;

declare const freedom: freedom.FreedomInModuleEnv;

var log :logging.Log = new logging.Log('churn');

export var filterCandidatesFromSdp = (sdp:string) : string => {
  return sdp.split('\n').filter((s) => {
    return s.indexOf('a=candidate') !== 0;
  }).join('\n');
}

export var getMidFromSdp = (sdp:string) : string => {
  var mids :string[] = [];
  sdp.split('\n').forEach((s) => {
    var match = s.match(/^a=mid:(\S+)\s*$/);
    if (match) {
      mids.push(match[1]);
    }
  });
  if (mids.length !== 1) {
    throw new Error('Expected 1 mid, but there are actually ' + mids.length);
  }
  return mids[0];
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
var generateCaesarConfig_ = (): caesar.Config => {
  try {
    return {
      key: (random.randomUint32() % 255) + 1
    };
  } catch (e) {
    // https://github.com/uProxy/uproxy/issues/1593
    log.warn('crypto unavailable, using Math.random');
    return {
      key: Math.floor((Math.random() * 255)) + 1
    };
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

  // Number of instances created, for logging purposes.
  private static id_ = 0;

  // The "mid" 
  private mid_ :string;

  // Maximum time to spend gathering ICE candidates.
  // We cap this so that slow STUN servers, in the absence
  // of trickle ICE, don't make the user wait unnecessarily.
  private static PROBE_TIMEOUT_MS_ = 3000;

  public peerOpenedChannelQueue :handler.QueueHandler<peerconnection.DataChannel, void>;
  public signalForPeerQueue :handler.Queue<ChurnSignallingMessage, void>;
  private candidateQueue_ :handler.Queue<Candidate, void>;

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

  // Fulfills once we know the obfuscator config, which may
  // happen in response to a signalling channel message.
  private haveTransformerConfig_ :(config:TransformerConfig) => void;
  private onceHaveTransformerConfig_ = new Promise((F, R) => {
    this.haveTransformerConfig_ = F;
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
              private name_ = 'unnamed-churn-' + Connection.id_,
              private skipPublicEndpoint_?:boolean,
              private portControl_?:freedom.PortControl.PortControl,
              private preferredTransformerConfig_?:TransformerConfig) {
    Connection.id_++;

    this.signalForPeerQueue = new handler.Queue<ChurnSignallingMessage,void>();
    this.candidateQueue_ = new handler.Queue<Candidate,void>();

    this.configureObfuscatedConnection_();
    // When the probe connection is complete, it will trigger the
    // creation of the churn pipe.
    this.configureProbeConnection_(probeRtcPc);

    // Forward onceXxx promises.
    this.onceConnected = this.obfuscatedConnection_.onceConnected;
    this.onceClosed = this.obfuscatedConnection_.onceClosed;

    // Debugging.
    this.onceHaveTransformerConfig_.then((config:TransformerConfig) => {
      log.info('%1: transformer config: %2', this.name_, config);
    });
  }

  private configureProbeConnection_ = (
      freedomPc:freedom.RTCPeerConnection.RTCPeerConnection) => {
    var probePeerName = this.name_ + '-probe';

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
              log.debug('%1: port control unavailable', this.name_);
            } else {
              log.info('%1: port control available', this.name_);
              this.portControl_.addMapping(c.relatedPort, c.port, MAP_LIFETIME).
                then((mapping:freedom.PortControl.Mapping) => {
                  if (mapping.externalPort === -1) {
                    log.debug('%1: addMapping() failed: %2',
                        this.name_, mapping);
                  } else {
                    log.info('%1: addMapping() success: ',
                        this.name_, mapping);
                  }
              });
            }
          }

          // We enqueue this candidate for transmission to the remote peer.
          // This queue will start draining once an Offer is available, so
          // that we can make sure that the mid matches.
          this.candidateQueue_.handle(c);

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
      log.warn('%1: probing timed out, closing probe connection', this.name_);
      this.probingComplete_();
    }, Connection.PROBE_TIMEOUT_MS_);

    this.onceProbingComplete_.then(() => {
      this.probeConnection_.close().then(() => {
        return this.onceHaveTransformerConfig_;
      }).then(this.configurePipe_).then(() => {
        this.processProbeCandidates_(candidates);
        this.havePipe_();
      });
    });

    this.probeConnection_.negotiateConnection();
  }

  private candidateQueueHandler_ = (candidate:Candidate) : Promise<void> => {
    // The candidate was generated by the probe connection, which might have a
    // different mid from the obfuscated connection.  Make sure that the mid
    // matches before we transmit the candidate.
    candidate.sdpMid = this.mid_;

    return this.signalForPeerQueue.handle({
      webrtcMessage: {
        type: signals.Type.CANDIDATE,
        candidate: candidate.toRTCIceCandidate()
      }
    });
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

  private configurePipe_ = (transformerConfig:TransformerConfig) : Promise<void> => {
    this.pipe_ = freedom['churnPipe'](this.name_);
    this.pipe_.on('mappingAdded', this.onMappingAdded_);
    return this.pipe_.setTransformer(transformerConfig);
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
      log.error('%1: got mapping for non-existent candidate', this.name_);
    }
  }

  private configureObfuscatedConnection_ = () => {
    // We use an empty configuration to ensure that no STUN servers are pinged.
    var obfConfig :freedom.RTCPeerConnection.RTCConfiguration = {
      iceServers: []
    };
    var obfPeerName = this.name_ + '-obfuscated';
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

        // We need to know the MID so that we can rewrite candidates to
        // have the correct MID before transmitting them.
        this.mid_ = getMidFromSdp(message.description.sdp);
        this.candidateQueue_.setHandler(this.candidateQueueHandler_);
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
              this.name_,
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
    // First, signal the obfuscation config. This will allow the
    // remote peer establish a matching churn pipe. If no config
    // was specified, use Caesar cipher for backwards compatibility.
    if (this.preferredTransformerConfig_) {
      this.signalForPeerQueue.handle({
        transformer: this.preferredTransformerConfig_
      });
      this.haveTransformerConfig_(this.preferredTransformerConfig_);
    } else {
      var caesarConfig = generateCaesarConfig_();
      this.signalForPeerQueue.handle({
        caesar: caesarConfig.key
      });
      this.haveTransformerConfig_({
        name: 'caesar',
        config: JSON.stringify(caesarConfig)
      });
    }

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
    if (churnMessage.transformer !== undefined) {
      this.haveTransformerConfig_(churnMessage.transformer);
    }
    if (churnMessage.caesar !== undefined) {
      log.debug('%1: received legacy caesar cipher config', this.name_);
      this.haveTransformerConfig_({
        name: 'caesar',
        config: JSON.stringify(<caesar.Config>{
          key: churnMessage.caesar
        })
      });
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
    var promises = [this.obfuscatedConnection_.close()];
    if (this.pipe_) {
      promises.push(this.pipe_.shutdown().catch((e) => {
        log.warn('Error while shutting down pipe: %1', e);
      }).then(() => {
        freedom['churnPipe'].close(this.pipe_);
      }));
    }
    return Promise.all(promises).then((voids:void[]) : void => {});
  }

  public toString = () : string => {
    return this.obfuscatedConnection_.toString();
  };
}
