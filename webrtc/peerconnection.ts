/// <reference path="../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path='../freedom/typings/rtcpeerconnection.d.ts' />
/// <reference path='../freedom/typings/freedom.d.ts' />

import DataChannels = require('datachannels');
import ArrayBuffers = require('../arraybuffers/arraybuffers');
import Logging = require('../logging/logging');
import Random = require('../crypto/random');
import Handler = require('../handler/queue');

import DataChannel = DataChannels.DataChannel;

// DataPeer - a class that wraps peer connections and data channels.
//
// This class assumes WebRTC is available; this is provided by freedom.js.

export interface PeerConnectionConfig {
  webrtcPcConfig         :freedom_RTCPeerConnection.RTCConfiguration;
  peerName               ?:string;   // For debugging
  initiateConnection     ?:boolean;  // defaults to false
}

export enum SignalType {
  OFFER, ANSWER, CANDIDATE, NO_MORE_CANDIDATES
}

export interface SignallingMessage {
  // CONSIDER: use string-enum when typescript supports it.
  type          :SignalType
  // The |candidate| parameter is set iff type === CANDIDATE
  candidate     ?:freedom_RTCPeerConnection.RTCIceCandidate;
  // The |description| parameter is set iff type === OFFER or
  // type === ANSWER
  description   ?:freedom_RTCPeerConnection.RTCSessionDescription;
}

// Possible candidate types, e.g. RELAY if a host is only accessible
// via a TURN server. The values are taken from this file; as the comment
// suggests, not all values may be found in practice:
//   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/libjingle/source/talk/p2p/base/port.cc

// This should match the uproxy-networking/network-typings/communications.d.ts
// type with the same name (Net.Endpoint).
export interface Endpoint {
  address:string; // IPv4, IPv6, or domain name.
  port:number;
}

export enum State {
  WAITING,      // Can move to CONNECTING.
  CONNECTING,   // Can move to CONNECTED or DISCONNECTED.
  CONNECTED,    // Can move to DISCONNECTED.
  DISCONNECTED  // End-state, cannot change.
};

// Quick port of djb2 for comparison of SDP headers to choose initiator.
export var stringHash = (s:string) : number => {
  var hash = 5381;
  for (var i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i); // hash * 33 + c
  }
  return hash;
}

// Logger for this module.
var log :Logging.Log = new Logging.Log('PeerConnection');

// Global listing of active peer connections. Helpful for debugging when you
// are in Freedom.
export var peerConnections :{ [name:string] : PeerConnection } = {};

// A wrapper for peer-connection and it's associated data channels.
// The most important diagram is this one:
// http://dev.w3.org/2011/webrtc/editor/webrtc.html#idl-def-RTCSignalingState
//
// Expected call-path to establish a connection...
// FIXME: This is obsolete due to freedom-v0.6 upgrades!
// We start by negotiate connection openning a data channel to make sure that
// the SDP headers have data channels in them.
//   0. negotiateConnection (public version)
//      0.1. openDataChannel -> pc_.createDataChannel
//      0.2. [callback] -> pc_.onnegotiation
//
// Then we start the real connection negotiation...
//   1. [external] negotiateConnection_ (private version)
//      1.1. createOffer_ -> pc_.createOffer
//      1.2. setLocalDescription_ -> pc_.setLocalDescription
//      1.3. signalForPeerQueue.handle -> [external]
//   2. [external] -> handleSignalMessage
//      2.1. setRemoteDescription_ -> pc_.setRemoteDescription
//   3. *[external] -> handleSignalMessage -> pc_.addIceCandidate
//   4. (callback) -> controlDataChannel.onceOpened
//      4.1. completeConnection_ -> pc_.getStats
//      4.3. [Fulfill onceConnected]
//
// When the peer starts the connection negotiation:
//   1. [external] -> handleSignalMessage
//      1.1. setRemoteDescription_ -> pc_.setRemoteDescription
//      1.3. createAnswer_
//      1.4. setLocalDescription_
//      1.5. signalForPeerQueue.handle -> [external]
//   2. *[external] -> handleSignalMessage -> pc_.addIceCandidate
//   3. (callback) -> controlDataChannel.onceOpened
//      3.1. completeConnection_ -> pc_.getStats
//      3.3. [Fulfill onceConnected]
export class PeerConnection {

  // Name for debugging.
  public peerName     :string;

  // The WebRtc peer connection.
  private pc_            :freedom_RTCPeerConnection.RTCPeerConnection;
  // All WebRtc data channels associated with this data peer.
  public dataChannels     :{[channelLabel:string] : DataChannel};

  // Internal promise completion functions for the |onceConnecting|,
  // |onceConnected| and |onceDisconnected| promises. Must only be
  // called once (per respective promise).
  private fulfillConnecting_    : () => void;
  private fulfillConnected_     :() => void;
  private rejectConnected_      :(e:Error) => void;
  private fulfillDisconnected_  :() => void;

  // The current state of the data peer;
  public pcState        :State;
  // Promise if fulfilled once we are starting to try to connect, either
  // because a peer sent us the appropriate signalling message (an offer) or
  // because we called negotiateConnection. Will be fulfilled before
  // |onceConnected|. Will never be rejected.
  public onceConnecting  :Promise<void>;
  // Fulfilled once we are connected to the peer. Rejected if connection fails
  // to be established.
  public onceConnected  :Promise<void>;
  // Fulfilled when disconnected. Will never reject.
  public onceDisconnected :Promise<void>;

  // Queue of channels opened up by the remote peer.
  public peerOpenedChannelQueue :Handler.Queue<DataChannel,void>;

  // Signals to be send to the remote peer by this peer.
  public signalForPeerQueue :Handler.Queue<SignallingMessage,void>;
  public fromPeerCandidateQueue :
      Handler.Queue<freedom_RTCPeerConnection.RTCIceCandidate,void>;

  // Data channel that acts as a control for if the peer connection should be
  // open or closed. Created during connection start up.
  // i.e. this connection's onceConnected is true once this data channel is
  // ready and the connection is closed if this data channel is closed.
  private controlDataChannel :DataChannel;
  // Label for the control data channel. Because channel labels must be
  // unique, the empty string was chosen to create a simple naming
  // restriction for new data channels--all other data channels must have
  // non-empty channel labels.
  private static CONTROL_CHANNEL_LABEL = '';

  // if |createOffer| is true, the constructor will immidiately initiate
  // negotiation.
  constructor(private config_ :PeerConnectionConfig) {
    if (config_.webrtcPcConfig === undefined) {
      throw new Error('must specify peerconnection config');
    }

    this.peerName = this.config_.peerName ||
        'unnamed-pc-' + Random.randomUint32();

    this.onceConnecting = new Promise<void>((F,R) => {
        this.fulfillConnecting_ = F;
      });
    this.onceConnected = new Promise<void>((F,R) => {
        // This ensures that onceConnecting consequences happen before
        // onceConnected.
        this.fulfillConnected_ = () => {
          this.onceConnecting.then(F);
        };
        this.rejectConnected_ = R;
      });
    this.onceDisconnected = new Promise<void>((F,R) => {
        this.fulfillDisconnected_ = F;
      });

    // Once connected, add to global listing. Helpful for debugging.
    this.onceConnected.then(() => {
      peerConnections[this.peerName] = this;
    });
    // Once disconnected, remove from global listing.
    this.onceDisconnected.then(() => {
      delete peerConnections[this.peerName];
    });

    // New data channels from the peer.
    this.peerOpenedChannelQueue = new Handler.Queue<DataChannel,void>();

    // Messages to send to the peer.
    this.signalForPeerQueue = new Handler.Queue<SignallingMessage,void>();

    // candidates form the peer; need to be queued until after remote
    // descrption has been set.
    this.fromPeerCandidateQueue =
        new Handler.Queue<freedom_RTCPeerConnection.RTCIceCandidate,void>();

    // This state variable is an abstraction of the PeerConnection state that
    // simplifies usage and management of state.
    this.pcState = State.WAITING;

    this.dataChannels = {};

    this.pc_ = freedom['core.rtcpeerconnection'](this.config_.webrtcPcConfig);
    // Add basic event handlers.
    this.pc_.on('onicecandidate', (candidate?:freedom_RTCPeerConnection.OnIceCandidateEvent) => {
      if(candidate.candidate) {
        this.signalForPeerQueue.handle({
          type: SignalType.CANDIDATE,
          candidate: candidate.candidate
        });
      } else {
        this.signalForPeerQueue.handle(
            {type: SignalType.NO_MORE_CANDIDATES});
      }
    });
    this.pc_.on('onnegotiationneeded', () => {
      this.negotiateConnection_().catch((e:Error) => {
        log.error(this.peerName + ': negotiateConnection: ' + e.toString() +
            '; this.toString()= ' + this.toString());
      });
    });
    this.pc_.on('ondatachannel', this.onPeerStartedDataChannel_);
    this.pc_.on('onsignalingstatechange', this.onSignallingStateChange_);
    this.pc_.on('oniceconnectionstatechange', this.onIceConnectionStateChange_);

    if(this.config_.initiateConnection) {
      this.negotiateConnection().catch((e:Error) => {
        log.error(this.peerName + ': negotiateConnection: ' + e.toString() +
          '; this.toString()= ' + this.toString());
      });
    }
  }

  // Close the peer connection. This function is idempotent.
  public close = () : void => {
    log.info(this.peerName + ': ' + 'close');

    // This may happen because calling close will invoke pc_.close, which
    // may call |onSignallingStateChange_| with |this.pc_.signalingState ===
    // 'closed'|.
    if (this.pcState === State.DISCONNECTED) { return; }

    if (this.pcState === State.CONNECTING) {
      this.rejectConnected_(new Error('close was called while connecting.'));
    }

    this.pcState = State.DISCONNECTED;
    this.fulfillDisconnected_();

    this.pc_.getSignalingState().then((state:string) => {
      if (state !== 'closed') {
        // Note is expected to invoke |onSignallingStateChange_|
        this.pc_.close();
      }
    });
  }

  private closeWithError_ = (s:string) : void => {
    log.error(this.peerName + ': ' + s);
    if (this.pcState === State.CONNECTING) {
      this.rejectConnected_(new Error(s));
    }
    this.pcState = State.DISCONNECTED;
    this.fulfillDisconnected_();
    this.pc_.getSignalingState().then((state:string) => {
      if (state !== 'closed') {
        // Note is expected to invoke |onSignallingStateChange_|
        this.pc_.close();
      }
    });
  }

  // The RTCPeerConnection signalingState has changed. This state change is
  // the result of either setLocalDescription() or setRemoteDescription()
  // being invoked. Or it can happen when the peer connection gets
  // unexpectedly closed down.
  private onSignallingStateChange_ = () : void => {
    this.pc_.getSignalingState().then((state) => {
      if (state === 'closed') {
        this.close();
        return;
      }

      if (state === 'stable' && this.pcState === State.CONNECTED) {
        // This happens when new data channels are created. TODO: file an issue
        // in Chrome; unclear that this should happen when creating new data
        // channels.
        // https://code.google.com/p/webrtc/issues/detail?id=2431
        return;
      }

      // Non-close signalling state changes should only be happening when state
      // is |CONNECTING|, otherwise this is an error.
      // Right now in chrome in state CONNECTED, re-negotiation can happen and
      // it will trigger non-close signalling state change. Till this behavior
      // changes, include CONNECTED state as well.
      if (this.pcState !== State.CONNECTING &&
          this.pcState !== State.CONNECTED) {
        // Something unexpected happened, better close down properly.
        this.closeWithError_(this.peerName + ': ' +
            'Unexpected onSignallingStateChange in state: ' +
            State[this.pcState]);
        return;
      }
    });
  }

  // The RTCPeerConnection iceConnectionState has changed.  This state change
  // is a result of the browser's ICE operations.  The state changes to
  // 'connected' when the peer is able to ping the other side and receive a
  // response, and goes to 'disconnected' or 'failed' if pings consistently
  // fail.
  private onIceConnectionStateChange_ = () : void => {
    var state = this.pc_.getIceConnectionState().then((state:string) => {
      // No action is needed when the state reaches 'connected', because
      // |this.completeConnection_| is called by the datachannel's |onopen|.
      if ((state === 'disconnected' || state === 'failed') &&
          this.pcState != State.DISCONNECTED) {
      this.closeWithError_('Connection lost: ' + state);
      }
    });
  }

  // Once we have connected, we need to fulfill the connection promise and set
  // the state.
  private completeConnection_ = () : void => {
    log.debug('completeConnection_, calling fulfillConnected_');
    this.pcState = State.CONNECTED;
    this.fulfillConnected_();
  }

  public negotiateConnection = () : Promise<void> => {
    log.debug('negotiateConnection()');
    // In order for the initial SDP header to include the provision for having
    // data channels (without it, we would have to re-negotiate SDP after the
    // PC is established), we start negotaition by openning a data channel to
    // the peer, this triggers the negotiation needed event.
    return this.openDataChannel(PeerConnection.CONTROL_CHANNEL_LABEL)
        .then(this.registerControlChannel_)
        .then(() => {
          return this.onceConnected;
        });
  }

  // Called when openDataChannel is called to and we have not yet negotiated
  // our connection, or called when some WebRTC internal event requires
  // renegotiation of SDP headers.
  private negotiateConnection_ = () : Promise<void> => {
    log.debug(this.peerName + ': ' + 'negotiateConnection_');
    if (this.pcState === State.DISCONNECTED) {
      return Promise.reject(new Error(this.peerName + ': ' +
          'negotiateConnection_ called on ' +
          'DISCONNECTED state.'));
    }

    if (this.pcState === State.CONNECTING) {
      return Promise.reject(new Error('Unexpected call to ' +
          'negotiateConnection_: ' + this.toString()));
    }

    // CONSIDER: might we ever need to re-create an onAnswer? Exactly how/when
    // do onnegotiation events get raised? Do they get raised on both sides?
    // Or only for the initiator?
    if (this.pcState === State.WAITING || this.pcState == State.CONNECTED) {
      this.pcState = State.CONNECTING;
      this.fulfillConnecting_();
      this.pc_.createOffer()
          .then(this.pc_.setLocalDescription)
          .then(this.pc_.getLocalDescription)
          .then((d:freedom_RTCPeerConnection.RTCSessionDescription) => {
            this.signalForPeerQueue.handle({
              type: SignalType.OFFER,
              description: {type: d.type, sdp: d.sdp}
            });
          })
          .catch((e) => {
            this.closeWithError_('Failed to set local description: ' +
                e.toString());
          });
      return this.onceConnected;
    }
  }

  // Fulfills if it is OK to proceed with setting this remote offer, or
  // rejects if there is a local offer with higher hash-precedence.
  private breakOfferTie_ = (remoteOffer:freedom_RTCPeerConnection.RTCSessionDescription) : Promise<void> => {
    return this.pc_.getSignalingState().then((state:string) => {
      if (state === 'have-local-offer') {
        return this.pc_.getLocalDescription().then(
            (localOffer:freedom_RTCPeerConnection.RTCSessionDescription) => {
          if (stringHash(JSON.stringify(remoteOffer.sdp)) <
              stringHash(JSON.stringify(localOffer.sdp))) {
            // TODO: implement reset and use their offer.
            return Promise.reject('Simultaneous offers not yet implemented.');
          } else {
            return Promise.resolve();
          }
        });
      } else {
        return Promise.resolve();
      }
    });
  }

  // Handle a signalling message from the remote peer.
  public handleSignalMessage = (signal :SignallingMessage) : void => {
    log.debug(this.peerName + ': ' + 'handleSignalMessage: \n' +
        JSON.stringify(signal));
    // If we are offering and they are also offerring at the same time, pick
    // the one who has the lower hash value for their description: this is
    // equivalent to having a special random id, but voids the need for an
    // extra random number. TODO: instead of hash, we could use the IP/port
    // candidate list which is guarenteed to be unique for 2 peers.
    switch(signal.type) {
      //
      case SignalType.OFFER:
        this.breakOfferTie_(signal.description).then(() => {
          this.pcState = State.CONNECTING;
          this.fulfillConnecting_();
          this.pc_.setRemoteDescription(signal.description)  // initial offer from peer
              .then(this.pc_.createAnswer)
              .then(this.pc_.setLocalDescription)
              .then(this.pc_.getLocalDescription)
              .then((d:freedom_RTCPeerConnection.RTCSessionDescription) => {
                this.signalForPeerQueue.handle(
                    {type: SignalType.ANSWER,
                     description: {type: d.type, sdp: d.sdp} });
              })
              .then(() => {
                this.fromPeerCandidateQueue.setHandler(this.pc_.addIceCandidate);
              })
              .catch((e) => {
                this.closeWithError_('Failed to connect to offer:' +
                    e.toString());
              });
            })
            .catch(this.closeWithError_);
        break;
      // Answer to an offer we sent
      case SignalType.ANSWER:
        this.pc_.setRemoteDescription(signal.description)
            .then(() => {
                this.fromPeerCandidateQueue.setHandler(this.pc_.addIceCandidate);
              })
            .catch((e) => {
                this.closeWithError_('Failed to set remote description: ' +
                    ': ' +  JSON.stringify(signal.description) + ' (' +
                    typeof(signal.description) + '); Error: ' + e.toString());
              });
        break;
      // Add remote ice candidate.
      case SignalType.CANDIDATE:
        // CONSIDER: Should we be passing/getting the SDP line index?
        // e.g. https://code.google.com/p/webrtc/source/browse/stable/samples/js/apprtc/js/main.js#331
        try {
          this.fromPeerCandidateQueue.handle(signal.candidate);
        } catch(e) {
          log.error(this.peerName + ': ' + 'addIceCandidate: ' +
              JSON.stringify(signal.candidate) + ' (' +
              typeof(signal.candidate) + '); Error: ' + e.toString());
        }
        break;
      case SignalType.NO_MORE_CANDIDATES:
        log.debug(this.peerName + ': handleSignalMessage: noMoreCandidates');
        break;

    default:
      log.error(this.peerName + ': ' +
          'handleSignalMessage got unexpected message: ' +
          JSON.stringify(signal) + ' (' + typeof(signal) + ')');
      break;
    }  // switch
  }

  // Open a new data channel with the peer.
  public openDataChannel = (channelLabel:string,
                            options?:freedom_RTCPeerConnection.RTCDataChannelInit)
      : Promise<DataChannel> => {
    log.debug(this.peerName + ': ' + 'openDataChannel: ' + channelLabel +
        '; options=' + JSON.stringify(options));

    // Only the control data channel can have an empty channel label.
    if (this.controlDataChannel != null && channelLabel === '') {
      throw new Error('Channel label can not be an empty string.');
    }

    return  this.pc_.createDataChannel(channelLabel, options)
        .then(this.addRtcDataChannel_);
  }

  // When a peer creates a data channel, this function is called with the
  // |RTCDataChannelEvent|. We then create the data channel wrapper and add
  // the new |DataChannel| to the |this.peerOpenedChannelQueue| to be
  // handled.
  private onPeerStartedDataChannel_ =
      (channelInfo:{channel:string}) : void => {
      log.debug(this.peerName + ': onPeerStartedDataChannel');
      this.addRtcDataChannel_(channelInfo.channel).then((dc:DataChannel) => {
        var label :string = dc.getLabel();
        if (label === PeerConnection.CONTROL_CHANNEL_LABEL) {
          // If the peer has started the control channel, register it
          // as this user's control channel as well.
          this.registerControlChannel_(dc);
        } else {
          // Aside from the control channel, all other channels should be
          // added to the queue of peer opened channels.
          this.peerOpenedChannelQueue.handle(dc);
        }
      });
    }

  // Add a rtc data channel and return the it wrapped as a DataChannel
  private addRtcDataChannel_ = (id:string)
      : Promise<DataChannel> => {
    return DataChannels.fromId(id).then((dataChannel:DataChannel) => {
      var label = dataChannel.getLabel();
      this.dataChannels[label] = dataChannel;
      dataChannel.onceClosed.then(() => {
        delete this.dataChannels[label];
      });
      return dataChannel;
    });
  }

  // Saves the given data channel as the control channel for this peer
  // connection. The appropriate callbacks for opening/closing
  // this channel are registered here.
  private registerControlChannel_ = (controlChannel:DataChannel)
      : Promise<void> => {
    this.controlDataChannel = controlChannel;
    this.controlDataChannel.onceClosed.then(this.close);
    return this.controlDataChannel.onceOpened.then(this.completeConnection_);
  }

  // For debugging: prints the state of the peer connection including all
  // associated data channels.
  public toString = () : string => {
    var s :string = this.peerName + ': { \n';
    var channelLabel :string;
    for (channelLabel in this.dataChannels) {
      s += '  ' + channelLabel + ': ' +
          this.dataChannels[channelLabel].toString() + '\n';
    }
    s += '}';
    return s;
  }
}  // class PeerConnection
