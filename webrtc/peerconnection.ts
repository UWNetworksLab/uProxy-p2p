/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/rtcpeerconnection.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />

import djb2 = require('../crypto/djb2hash');
import handler = require('../handler/queue');
import datachannel = require('./datachannel');

import logging = require('../logging/logging');
var log :logging.Log = new logging.Log('PeerConnection');

// These are exported for convenience so that typescript tools that use
// peerconnection.ts only need to require peerconnection and not datachannel.
export interface DataChannel extends datachannel.DataChannel {}
export interface Data extends datachannel.Data {}

// This should match the uproxy-networking/network-typings/communications.d.ts
// type with the same name (Net.Endpoint).
export interface Endpoint {
  address:string; // IPv4, IPv6, or domain name.
  port:number;
}

// This enum describes a simple signal message protocol for establishing P2P
// connections. TODO: rename to more accurately describe the intended
// abstraction: namely: INIT, DATA, END
export enum SignalType {
  OFFER,              // INIT new connection
  ANSWER,             // ACK of new connection
  // Possible candidate types, e.g. RELAY if a host is only accessible
  // via a TURN server. The values are taken from this file; as the comment
  // suggests, not all values may be found in practice:
  //   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/webrtc/p2p/base/port.cc&q=port.cc&l=107
  CANDIDATE,          // signal data to send to peer
  NO_MORE_CANDIDATES  // no more data to send to peer
}

// Describes the state of a P2P connection.
export enum State {
  WAITING,      // Can move to CONNECTING.
  CONNECTING,   // Can move to CONNECTED or DISCONNECTED.
  CONNECTED,    // Can move to DISCONNECTED.
  DISCONNECTED  // End-state, cannot change.
}

export interface PeerConnection<TSignallingMessage> {
  // The state of this peer connection.
  pcState :State;

  // All open data channels.
  // NOTE: There exists a bug in Chrome prior to version 37 which causes
  //       entries in this object to continue to exist even after
  //       the remote peer has closed a data channel.
  dataChannels     :{[channelLabel:string] : DataChannel};

  // The |onceConnecting| promise is fulfilled when |pcState === CONNECTING|.
  // i.e. when either |handleSignalMessage| is called with an offer message,
  // or when |negotiateConnection| is called. The promise is never be rejected
  // and is guarenteed to fulfilled before |onceConnected|.
  onceConnecting  :Promise<void>;
  // The |onceConnected| promise is fulfilled when pcState === CONNECTED
  onceConnected :Promise<void>;
  // The |onceDisconnected| promise is fulfilled when pcState === DISCONNECTED
  onceDisconnected :Promise<void>;

  // Try to connect to the peer. Will change state from |WAITING| to
  // |CONNECTING|. If there was an error, promise is rejected. Otherwise
  // returned promise === |onceConnected|.
  negotiateConnection :() => Promise<void>;

  // A peer connection can either open a data channel to the peer (will
  // change from |WAITING| state to |CONNECTING|)
  openDataChannel :(channelLabel: string,
      options?: freedom_RTCPeerConnection.RTCDataChannelInit) =>
      Promise<DataChannel>;
  // Or handle data channels opened by the peer (these events will )
  peerOpenedChannelQueue :handler.QueueHandler<DataChannel, void>;

  // The |handleSignalMessage| function should be called with signalling
  // messages from the remote peer.
  handleSignalMessage :(signal:TSignallingMessage) => void;
  // The underlying handler that holds/handles signals intended to go to the
  // remote peer. A handler should be set that sends messages to the remote
  // peer.
  signalForPeerQueue :handler.QueueHandler<TSignallingMessage, void>;

  // Closing the peer connection will close all associated data channels
  // and set |pcState| to |DISCONNECTED| (and hence fulfills
  // |onceDisconnected|)
  close: () => void;
}

export interface SignallingMessage {
  // TODO: make an abstraction for the data, only the signal type needs to be
  // known by consumers of this type.
  type          :SignalType
  // The |candidate| parameter is set iff type === CANDIDATE
  candidate     ?:freedom_RTCPeerConnection.RTCIceCandidate;
  // The |description| parameter is set iff type === OFFER or
  // type === ANSWER
  description   ?:freedom_RTCPeerConnection.RTCSessionDescription;
}

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
//   4. (callback) -> controlDataChannel_.onceOpened
//      4.1. completeConnection_ -> [Fulfill onceConnected]
//
// When the peer starts the connection negotiation:
//   1. [external] -> handleSignalMessage
//      1.1. setRemoteDescription_ -> pc_.setRemoteDescription
//      1.3. createAnswer_
//      1.4. setLocalDescription_
//      1.5. signalForPeerQueue.handle -> [external]
//   2. *[external] -> handleSignalMessage -> pc_.addIceCandidate
//   3. (callback) -> controlDataChannel_.onceOpened
//      3.1. completeConnection_ -> [Fulfill onceConnected]
export class PeerConnectionClass implements PeerConnection<SignallingMessage> {

  // Global listing of active peer connections. Helpful for debugging when you
  // are in Freedom.
  public static peerConnections :{ [name:string] : PeerConnection<SignallingMessage> } = {};

  // All WebRtc data channels associated with this data peer.
  public dataChannels     :{[channelLabel:string] : DataChannel};

  // The current state of the data peer;
  public pcState :State;
  // Promise if fulfilled once we are starting to try to connect, either
  // because a peer sent us the appropriate signalling message (an offer) or
  // because we called negotiateConnection. Will be fulfilled before
  // |onceConnected|. Will never be rejected.
  public onceConnecting :Promise<void>;
  // Fulfilled once we are connected to the peer. Rejected if connection fails
  // to be established.
  public onceConnected :Promise<void>;
  // Fulfilled when disconnected. Will never reject.
  public onceDisconnected :Promise<void>;

  // Queue of channels opened up by the remote peer.
  public peerOpenedChannelQueue :handler.Queue<DataChannel,void>;

  // Signals to be send to the remote peer by this peer.
  public signalForPeerQueue :handler.Queue<SignallingMessage,void>;
  public fromPeerCandidateQueue :
      handler.Queue<freedom_RTCPeerConnection.RTCIceCandidate,void>;

  // Internal promise completion functions for the |onceConnecting|,
  // |onceConnected| and |onceDisconnected| promises. Must only be
  // called once (per respective promise).
  private fulfillConnecting_    : () => void;
  private fulfillConnected_     :() => void;
  private rejectConnected_      :(e:Error) => void;
  private fulfillDisconnected_  :() => void;

  // Data channel that acts as a control for if the peer connection should be
  // open or closed. Created during connection start up.
  // i.e. this connection's onceConnected is true once this data channel is
  // ready and the connection is closed if this data channel is closed.
  private controlDataChannel_ :DataChannel;
  // Label for the control data channel. Because channel labels must be
  // unique, the empty string was chosen to create a simple naming
  // restriction for new data channels--all other data channels must have
  // non-empty channel labels.
  private static CONTROL_CHANNEL_LABEL = '';

  // Number of automatically generated names generated so far.
  private static automaticNameIndex_ = 0;

  constructor(
      private pc_:freedom_RTCPeerConnection.RTCPeerConnection,
      // Public for debugging; note this is not part of the peer connection
      // interface
      public peerName_ ?:string) {
    this.peerName_ = this.peerName_ ||
        ('unnamed-' + (++PeerConnectionClass.automaticNameIndex_));

    this.onceConnecting = new Promise<void>((F,R) => {
        this.fulfillConnecting_ = F;
      });
    this.onceConnected = new Promise<void>((F,R) => {
        // This ensures that onceConnecting consequences happen before
        // onceConnected.
        this.fulfillConnected_ = () => { this.onceConnecting.then(F); };
        this.rejectConnected_ = R;
      });
    this.onceDisconnected = new Promise<void>((F,R) => {
        this.fulfillDisconnected_ = F;
      });

    // Once connected, add to global listing. Helpful for debugging.
    // Once disconnected, remove from global listing.
    this.onceConnected.then(() => {
      PeerConnectionClass.peerConnections[this.peerName_] = this;
      this.onceDisconnected.then(() => {
        delete PeerConnectionClass.peerConnections[this.peerName_];
      });
    }, (e:Error) => {
      log.debug('%1: failed to connect, not available for ' +
          ' debugging in peerConnections', this.peerName_);
    });

    // New data channels from the peer.
    this.peerOpenedChannelQueue = new handler.Queue<DataChannel,void>();

    // Messages to send to the peer.
    this.signalForPeerQueue = new handler.Queue<SignallingMessage,void>();

    // candidates form the peer; need to be queued until after remote
    // descrption has been set.
    this.fromPeerCandidateQueue =
        new handler.Queue<freedom_RTCPeerConnection.RTCIceCandidate,void>();

    // This state variable is an abstraction of the PeerConnection state that
    // simplifies usage and management of state.
    this.pcState = State.WAITING;

    this.dataChannels = {};

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
        log.error(this.peerName_ + ': negotiateConnection: ' + e.toString() +
            '; this.toString()= ' + this.toString());
      });
    });
    this.pc_.on('ondatachannel', this.onPeerStartedDataChannel_);
    this.pc_.on('onsignalingstatechange', this.onSignallingStateChange_);
    this.pc_.on('oniceconnectionstatechange', this.onIceConnectionStateChange_);
  }

  // Close the peer connection. This function is idempotent.
  public close = () : void => {
    log.info(this.peerName_ + ': ' + 'close');

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
    log.error(this.peerName_ + ': ' + s);
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
        this.closeWithError_(this.peerName_ + ': ' +
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
    return this.openDataChannel(PeerConnectionClass.CONTROL_CHANNEL_LABEL)
        .then(this.registerControlChannel_)
        .then(() => {
          return this.onceConnected;
        });
  }

  // Called when openDataChannel is called to and we have not yet negotiated
  // our connection, or called when some WebRTC internal event requires
  // renegotiation of SDP headers.
  private negotiateConnection_ = () : Promise<void> => {
    log.debug(this.peerName_ + ': ' + 'negotiateConnection_');
    if (this.pcState === State.DISCONNECTED) {
      return Promise.reject(new Error(this.peerName_ + ': ' +
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
          .then((d:freedom_RTCPeerConnection.RTCSessionDescription) => {
            // Emit the offer signal before calling setLocalDescription, which
            // initiates ICE candidate gathering. If we did the reverse then
            // we may emit ICE candidate signals before the offer, confusing
            // some clients:
            //   https://github.com/uProxy/uproxy/issues/784
            this.signalForPeerQueue.handle({
              type: SignalType.OFFER,
              description: {type: d.type, sdp: d.sdp}
            });
            this.pc_.setLocalDescription(d);
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
          if (djb2.stringHash(JSON.stringify(remoteOffer.sdp)) <
              djb2.stringHash(JSON.stringify(localOffer.sdp))) {
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

  private handleOfferSignalMessage_ =
      (description:freedom_RTCPeerConnection.RTCSessionDescription) : void => {
    this.breakOfferTie_(description)
      .then(() => {
        this.pcState = State.CONNECTING;
        this.fulfillConnecting_();
        // initial offer from peer
        return this.pc_.setRemoteDescription(description)
      })
      .then(this.pc_.createAnswer)
      .then((d:freedom_RTCPeerConnection.RTCSessionDescription) => {
        // As with the offer, we must emit the signal before
        // setting the local description to ensure that we send the
        // ANSWER before any ICE candidates.
        this.signalForPeerQueue.handle(
            {type: SignalType.ANSWER,
             description: {type: d.type, sdp: d.sdp} });
        this.pc_.setLocalDescription(d);
      })
      .then(() => {
        this.fromPeerCandidateQueue.setHandler(this.pc_.addIceCandidate);
      })
      .catch((e) => {
        this.closeWithError_('Failed to connect to offer:' +
            e.toString());
      });
  }

  private handleAnswerSignalMessage_ =
      (description:freedom_RTCPeerConnection.RTCSessionDescription) : void => {
    this.pc_.setRemoteDescription(description)
      .then(() => {
        this.fromPeerCandidateQueue.setHandler(this.pc_.addIceCandidate);
      })
      .catch((e) => {
        this.closeWithError_('Failed to set remote description: ' +
            ': ' +  JSON.stringify(description) + ' (' +
            typeof(description) + '); Error: ' + e.toString());
      });
  }

  private handleCandidateSignalMessage_ =
    (candidate:freedom_RTCPeerConnection.RTCIceCandidate) : void => {
    // CONSIDER: Should we be passing/getting the SDP line index?
    // e.g. https://code.google.com/p/webrtc/source/browse/stable/samples/js/apprtc/js/main.js#331
    try {
      this.fromPeerCandidateQueue.handle(candidate);
    } catch(e) {
      log.error(this.peerName_ + ': ' + 'addIceCandidate: ' +
        JSON.stringify(candidate) + ' (' + typeof(candidate) +
        '); Error: ' + e.toString());
    }
  }

  // Handle a signalling message from the remote peer.
  public handleSignalMessage = (signal :SignallingMessage) : void => {
    log.debug(this.peerName_ + ': ' + 'handleSignalMessage: \n' +
        JSON.stringify(signal));
    // If we are offering and they are also offerring at the same time, pick
    // the one who has the lower hash value for their description: this is
    // equivalent to having a special random id, but voids the need for an
    // extra random number. TODO: instead of hash, we could use the IP/port
    // candidate list which is guarenteed to be unique for 2 peers.
    switch(signal.type) {
      case SignalType.OFFER:
        this.handleOfferSignalMessage_(signal.description);
        break;
      // Answer to an offer we sent
      case SignalType.ANSWER:
        this.handleAnswerSignalMessage_(signal.description);
        break;
      // Add remote ice candidate.
      case SignalType.CANDIDATE:
        this.handleCandidateSignalMessage_(signal.candidate);
        break;
      case SignalType.NO_MORE_CANDIDATES:
        log.debug(this.peerName_ + ': handleSignalMessage: noMoreCandidates');
        break;

    default:
      log.error(this.peerName_ + ': ' +
          'handleSignalMessage got unexpected message: ' +
          JSON.stringify(signal) + ' (' + typeof(signal) + ')');
      break;
    }  // switch
  }

  // Open a new data channel with the peer.
  public openDataChannel = (channelLabel:string,
                            options?:freedom_RTCPeerConnection.RTCDataChannelInit)
      : Promise<DataChannel> => {
    log.debug(this.peerName_ + ': ' + 'openDataChannel: ' + channelLabel +
        '; options=' + JSON.stringify(options));

    // Only the control data channel can have an empty channel label.
    if (this.controlDataChannel_ != null && channelLabel === '') {
      throw new Error('Channel label can not be an empty string.');
    }

    return this.pc_.createDataChannel(channelLabel, options)
        .then(this.addRtcDataChannel_);
  }

  // When a peer creates a data channel, this function is called with the
  // |RTCDataChannelEvent|. We then create the data channel wrapper and add
  // the new |DataChannel| to the |this.peerOpenedChannelQueue| to be
  // handled.
  private onPeerStartedDataChannel_ =
      (channelInfo:{channel:string}) : void => {
      log.debug(this.peerName_ + ': onPeerStartedDataChannel');
      this.addRtcDataChannel_(channelInfo.channel).then((dc:DataChannel) => {
        var label :string = dc.getLabel();
        if (label === PeerConnectionClass.CONTROL_CHANNEL_LABEL) {
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
    return datachannel.createFromFreedomId(id)
        .then((dataChannel:DataChannel) => {
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
    this.controlDataChannel_ = controlChannel;
    this.controlDataChannel_.onceClosed.then(this.close);
    return this.controlDataChannel_.onceOpened.then(this.completeConnection_);
  }

  // For debugging: prints the state of the peer connection including all
  // associated data channels.
  public toString = () : string => {
    var s :string = this.peerName_ + ': { \n';
    var channelLabel :string;
    for (channelLabel in this.dataChannels) {
      s += '  ' + channelLabel + ': ' +
          this.dataChannels[channelLabel].toString() + '\n';
    }
    s += '}';
    return s;
  }
}  // class PeerConnectionClass

export function createPeerConnection(
    config:freedom_RTCPeerConnection.RTCConfiguration, debugPcName?:string)
    : PeerConnection<SignallingMessage> {
  var freedomRtcPc = freedom['core.rtcpeerconnection'](config);
  // Note: |peerConnection| will take responsibility for freeing memory and
  // closing down of |freedomRtcPc| once the underlying peer connection is
  // closed.
  return new PeerConnectionClass(freedomRtcPc, debugPcName);
}

