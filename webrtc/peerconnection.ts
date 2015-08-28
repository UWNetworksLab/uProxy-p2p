/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/rtcpeerconnection.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />

import djb2 = require('../crypto/djb2hash');
import handler = require('../handler/queue');
import datachannel = require('./datachannel');
import signals = require('./signals');

import logging = require('../logging/logging');
var log :logging.Log = new logging.Log('PeerConnection');

// These are exported for convenience so that typescript tools that use
// peerconnection.ts only need to require peerconnection and not datachannel.
export interface DataChannel extends datachannel.DataChannel {}
export interface Data extends datachannel.Data {}

// Describes the state of a P2P connection.
export enum State {
  WAITING,      // Can move to CONNECTING.
  CONNECTING,   // Can move to CONNECTED or CLOSED.
  CONNECTED,    // Can move to CLOSED.
  CLOSED  // End-state, cannot change.
}

export interface PeerConnection<TSignallingMessage> {
  // Fulfills once a connection been established with the peer.
  // Rejects if there is an error establishing the connection.
  onceConnected :Promise<void>;

  // Fulfills when the peerconnection closes or fails to open.
  // Never rejects.
  onceClosed :Promise<void>;

  // Initiates a peerconnection.
  // Returns onceConnected.
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
  handleSignalMessage :(message:TSignallingMessage) => void;
  // The underlying handler that holds/handles signals intended to go to the
  // remote peer. A handler should be set that sends messages to the remote
  // peer.
  signalForPeerQueue :handler.QueueHandler<TSignallingMessage, void>;

  // Closes the peerconnection, fulfilling once the connection has closed.
  close: () => Promise<void>;
}

// Label for the control data channel. Because channel labels must be
// unique, the empty string was chosen to create a simple naming
// restriction for new data channels--all other data channels must have
// non-empty channel labels.
var CONTROL_CHANNEL_LABEL = '';

// Interval, in milliseconds, after which the peerconnection will
// terminate if no heartbeat is received from the peer.
var HEARTBEAT_TIMEOUT_MS_ = 15000;

// Interval, in milliseconds, at which heartbeats are sent to the peer.
var HEARTBEAT_INTERVAL_MS_ = 5000;

// Message which is sent for heartbeats.
var HEARTBEAT_MESSAGE_ = 'heartbeat';

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
export class PeerConnectionClass implements PeerConnection<signals.Message> {
  // Count of instances created to date.
  private static numCreations_ :number = 0;

  // All open data channels associated with this peerconnection.
  private channels_ :{[channelLabel:string]:DataChannel} = {};

  // Current state of this peer.
  private state_ = State.WAITING;

  private fulfillConnected_ :() => void;
  private rejectConnected_ :(e:Error) => void;
  public onceConnected = new Promise<void>((F,R) => {
    this.fulfillConnected_ = F;
    this.rejectConnected_ = R;
  });

  private fulfillClosed_  :() => void;
  public onceClosed = new Promise<void>((F,R) => {
    this.fulfillClosed_ = F;
  });

  // Fulfills once the remote description has been set.
  // Used to delay setting of remote ICE candidates until the call to
  // setRemoteDescription has resolved, which can cause timing issues.
  private fulfillHaveRemoteDescription_ :() => void;
  private onceHaveRemoteDescription_ = new Promise<void>((F, R) => {
    this.fulfillHaveRemoteDescription_ = F;
  });

  public peerOpenedChannelQueue = new handler.Queue<DataChannel,void>();

  public signalForPeerQueue = new handler.Queue<signals.Message,void>();

  constructor(
      private pc_:freedom_RTCPeerConnection.RTCPeerConnection,
      private peerName_ = ('unnamed-' + PeerConnectionClass.numCreations_)) {
    PeerConnectionClass.numCreations_++;

    this.pc_.on('onicecandidate', this.onIceCandidate_);
    this.pc_.on('onnegotiationneeded', this.onNegotiationNeeded_);
    this.pc_.on('ondatachannel', this.onPeerStartedDataChannel_);
    this.pc_.on('onsignalingstatechange', this.onSignallingStateChange_);
    this.pc_.on('oniceconnectionstatechange', this.onIceConnectionStateChange_);
  }

  // Close the peer connection. This function is idempotent.
  public close = () : Promise<void> => {
    log.debug('%1: close', this.peerName_);

    if (this.state_ === State.CONNECTING) {
      this.rejectConnected_(new Error('close was called while connecting.'));
    }

    this.state_ = State.CLOSED;
    this.fulfillClosed_();

    return this.pc_.getSignalingState().then((state:string) => {
      if (state !== 'closed') {
        // Note is expected to invoke |onSignallingStateChange_|
        return this.pc_.close();
      }
    });
  }

  private closeWithError_ = (s:string) : void => {
    if (this.state_ === State.CONNECTING) {
      this.rejectConnected_(new Error(s));
    }
    this.state_ = State.CLOSED;
    this.fulfillClosed_();
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
      log.debug('%1: signalling state: %2', this.peerName_, state);

      if (state === 'closed') {
        this.close();
        return;
      }

      if (state === 'stable' && this.state_ === State.CONNECTED) {
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
      if (this.state_ !== State.CONNECTING &&
          this.state_ !== State.CONNECTED) {
        // Something unexpected happened, better close down properly.
        this.closeWithError_('Unexpected onSignallingStateChange in state: ' +
            State[this.state_]);
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
      log.debug('%1: ice connection state: %2', this.peerName_, state);

      if (state === 'disconnected') {
        log.warn('%1: transient disconnection detected', this.peerName_);
      }

      // No action is needed when the state reaches 'connected', because
      // |this.completeConnection_| is called by the datachannel's |onopen|.
      if (state === 'failed' && this.state_ !== State.CLOSED) {
        this.closeWithError_('Connection lost: ' + state);
      }
    });
  }

  public negotiateConnection = () : Promise<void> => {
    log.debug('%1: negotiateConnection', this.peerName_);

    // In order for the initial SDP header to include the provision for having
    // data channels (without it, we would have to re-negotiate SDP after the
    // PC is established), we start negotaition by openning a data channel to
    // the peer, this triggers the negotiation needed event.
    return this.pc_.createDataChannel(CONTROL_CHANNEL_LABEL, {id: 0}).then(
        this.addRtcDataChannel_).then(
        this.registerControlChannel_).then(() => {
          return this.onceConnected;
        });
  }

  // Called when an on onnegotiationneeded event is received.
  private onNegotiationNeeded_ = () : void => {
    log.debug('%1: negotiation needed', this.peerName_);

    // CONSIDER: might we ever need to re-create an onAnswer? Exactly how/when
    // do onnegotiation events get raised? Do they get raised on both sides?
    // Or only for the initiator?
    if (this.state_ === State.WAITING || this.state_ === State.CONNECTED) {
      this.state_ = State.CONNECTING;
      this.pc_.createOffer().then(
          (d:freedom_RTCPeerConnection.RTCSessionDescription) => {
        log.debug('%1: created offer: %2', this.peerName_, d);

        // Emit the offer signal before calling setLocalDescription, which
        // initiates ICE candidate gathering. If we did the reverse then
        // we may emit ICE candidate signals before the offer, confusing
        // some clients:
        //   https://github.com/uProxy/uproxy/issues/784
        this.emitSignalForPeer_({
          type: signals.Type.OFFER,
          description: {
            type: d.type,
            sdp: d.sdp
          }
        });
        this.pc_.setLocalDescription(d);
      }).catch((e:Error) => {
        this.closeWithError_('failed to set local description: ' + e.message);
      });
    } else {
      // This should never happen, but in Firefox 40+, we get a redundant
      // event because both the browser and the polyfill generate one.
      // TODO: Remove the polyfill, and make this warning an error, once
      // Firefox <40 is no longer supported.
      log.warn('onnegotiationneeded fired in unexpected state ' +
          State[this.state_]);
    }
  }

  // Fulfills if it is OK to proceed with setting this remote offer, or
  // rejects if there is a local offer with higher hash-precedence.
  private breakOfferTie_ = (remoteOffer:freedom_RTCPeerConnection.RTCSessionDescription)
      : Promise<void> => {
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

  private onIceCandidate_ = (candidate?:freedom_RTCPeerConnection.OnIceCandidateEvent) => {
    if(candidate.candidate) {
      log.debug('%1: local ice candidate: %2',
          this.peerName_, candidate.candidate);
      this.emitSignalForPeer_({
        type: signals.Type.CANDIDATE,
        candidate: candidate.candidate
      });
    } else {
      log.debug('%1: no more ice candidates', this.peerName_);
      this.emitSignalForPeer_({
        type: signals.Type.NO_MORE_CANDIDATES
      });
    }
  }

  private handleOfferSignalMessage_ = (
      description:freedom_RTCPeerConnection.RTCSessionDescription)
      : Promise<void> => {
    return this.breakOfferTie_(description).then(() => {
      this.state_ = State.CONNECTING;
      // initial offer from peer
      return this.pc_.setRemoteDescription(description)
    }).then(this.pc_.createAnswer).then(
        (d:freedom_RTCPeerConnection.RTCSessionDescription) => {
      log.debug('%1: created answer: %2', this.peerName_, d);

      // As with the offer, we must emit the signal before
      // setting the local description to ensure that we send the
      // ANSWER before any ICE candidates.
      this.emitSignalForPeer_({
        type: signals.Type.ANSWER,
        description: {
          type: d.type,
          sdp: d.sdp
        }
      });
      return this.pc_.setLocalDescription(d);
    }).catch((e) => {
      this.closeWithError_('Failed to connect to offer:' +
          e.toString());
    });
  }

  private handleAnswerSignalMessage_ = (
      description:freedom_RTCPeerConnection.RTCSessionDescription)
      : Promise<void> => {
    return this.pc_.setRemoteDescription(description).catch((e) => {
      this.closeWithError_('Failed to set remote description: ' +
        JSON.stringify(description) + '; Error: ' + e.toString());
    });
  }

  private handleCandidateSignalMessage_ = (
      candidate:freedom_RTCPeerConnection.RTCIceCandidate)
      : Promise<void> => {
    // CONSIDER: Should we be passing/getting the SDP line index?
    // e.g. https://code.google.com/p/webrtc/source/browse/stable/samples/js/apprtc/js/main.js#331
    return this.pc_.addIceCandidate(candidate).catch((e: Error) => {
      log.error('%1: addIceCandidate: %2; Error: %3', this.peerName_, candidate,
        e.toString());
    });
  }

  // Adds a signalling message to this.signalForPeerQueue.
  private emitSignalForPeer_ = (message:signals.Message) : void => {
    this.signalForPeerQueue.handle(message);
  }

  // Handle a signalling message from the remote peer.
  // Return type is for testing.
  // TODO: consider adding return type to PeerConnection interface
  public handleSignalMessage = (message:signals.Message) : Promise<void> => {
    log.info('%1: handling signal from peer: %2', this.peerName_, message);

    // If we are offering and they are also offering at the same time, pick
    // the one who has the lower hash value for their description: this is
    // equivalent to having a special random id, but voids the need for an
    // extra random number.
    // TODO: Instead of hash, we could use the IP/port candidate list which
    //       is guaranteed to be unique for 2 peers.
    switch(message.type) {
      case signals.Type.OFFER:
        return this.handleOfferSignalMessage_(message.description).then(
            this.fulfillHaveRemoteDescription_);
        break;
      // Answer to an offer we sent
      case signals.Type.ANSWER:
        return this.handleAnswerSignalMessage_(message.description).then(
            this.fulfillHaveRemoteDescription_);
        break;
      // Add remote ice candidate.
      case signals.Type.CANDIDATE:
        return this.onceHaveRemoteDescription_.then(() => {
          return this.handleCandidateSignalMessage_(message.candidate);
        });
        break;
      case signals.Type.NO_MORE_CANDIDATES:
        return Promise.resolve<void>();
        break;
      default:
        return Promise.reject(new Error(
            'unexpected signalling message type ' + message.type));
    }
  }

  // Open a new data channel with the peer.
  public openDataChannel = (channelLabel:string,
      options?:freedom_RTCPeerConnection.RTCDataChannelInit)
      : Promise<DataChannel> => {
    if (channelLabel === '') {
      throw new Error('label cannot be an empty string');
    }

    log.debug('%1: creating channel %2 with options: %3',
        this.peerName_, channelLabel, options);

    return this.pc_.createDataChannel(channelLabel, options).then(
        this.addRtcDataChannel_);
  }

  // When a peer creates a data channel, this function is called with the
  // |RTCDataChannelEvent|. We then create the data channel wrapper and add
  // the new |DataChannel| to the |this.peerOpenedChannelQueue| to be
  // handled.
  private onPeerStartedDataChannel_ =
      (channelInfo:{channel:string}) : void => {
      this.addRtcDataChannel_(channelInfo.channel).then((dc:DataChannel) => {
        var label :string = dc.getLabel();
        log.debug('%1: peer created channel %2', this.peerName_, label);
        if (label === CONTROL_CHANNEL_LABEL) {
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
      this.channels_[label] = dataChannel;
      dataChannel.onceClosed.then(() => {
        delete this.channels_[label];
        if (label === '') {
          log.debug('%1: discarded control channel', this.peerName_);
        } else {
          log.debug('%1: discarded channel %2 (%3 remaining)',
              this.peerName_, label, Object.keys(this.channels_).length);
        }
      });
      return dataChannel;
    });
  }

  // Saves the given data channel as the control channel for this peer
  // connection. The appropriate callbacks for opening, closing, and
  // initiating a heartbeat are registered here.
  private registerControlChannel_ = (channel:DataChannel) : void => {
    channel.onceOpened.then(() => {
      this.initiateHeartbeat_(channel);
      this.state_ = State.CONNECTED;
      this.fulfillConnected_();
    }).catch((e: Error) => {
      log.debug('%1: control channel failed to open: %2',
          this.peerName_, e.message);
    });
    channel.onceClosed.then(this.close);
  }

  // Heartbeats take the form of a string message sent over the control
  // channel at regular intervals; if no heartbeat is received from the
  // remote peer for >HEARTBEAT_TIMEOUT_MS_ then the peerconnection is
  // closed with an error. The motivation for this is Firefox's poor
  // handling of sudden connection closures:
  //   https://github.com/uProxy/uproxy/issues/1358
  private initiateHeartbeat_ = (channel:DataChannel) : void => {
    log.debug('%1: initiating heartbeat', this.peerName_);

    // Listen for heartbeats from the other side.
    var lastPingTimestamp :number = Date.now();
    channel.dataFromPeerQueue.setSyncHandler((data:Data) => {
      if (data.str === HEARTBEAT_MESSAGE_) {
        lastPingTimestamp = Date.now();
      } else {
        log.warn('%1: unexpected data on control channel: %2',
            this.peerName_, data);
      }
    });

    // Send and monitors heartbeats.
    var loop = setInterval(() => {
      channel.send({
        str: HEARTBEAT_MESSAGE_
      }).catch((e:Error) => {
        log.error('%1: error sending heartbeat: %2',
            this.peerName_, e.message);
      });

      if (Date.now() - lastPingTimestamp > HEARTBEAT_TIMEOUT_MS_) {
        log.debug('%1: heartbeat timeout, terminating', this.peerName_);
        this.closeWithError_('no heartbeat received for >' +
            HEARTBEAT_TIMEOUT_MS_ + 'ms');
        clearInterval(loop);
      }
    }, HEARTBEAT_INTERVAL_MS_);
  }

  // For debugging: prints the state of the peer connection including all
  // associated data channels.
  public toString = () : string => {
    var s :string = this.peerName_ + ': { \n';
    var channelLabel :string;
    for (channelLabel in this.channels_) {
      s += '  ' + channelLabel + ': ' +
          this.channels_[channelLabel].toString() + '\n';
    }
    s += '}';
    return s;
  }
}  // class PeerConnectionClass

export function createPeerConnection(
    config:freedom_RTCPeerConnection.RTCConfiguration, debugPcName?:string)
    : PeerConnection<signals.Message> {
  var freedomRtcPc = freedom['core.rtcpeerconnection'](config);
  // Note: |peerConnection| will take responsibility for freeing memory and
  // closing down of |freedomRtcPc| once the underlying peer connection is
  // closed.
  return new PeerConnectionClass(freedomRtcPc, debugPcName);
}
