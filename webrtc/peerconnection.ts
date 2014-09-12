/// <reference path='RTCPeerConnection.d.ts' />
/// <reference path="../crypto/random.d.ts"/>
/// <reference path='../handler/queue.d.ts' />
/// <reference path="../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path='../third_party/typings/webrtc/RTCPeerConnection.d.ts' />
/// <reference path='../logging/logging.d.ts' />

/// <reference path='datachannel.ts' />

// DataPeer - a class that wraps peer connections and data channels.
//
// This class assumes WebRTC is available; this is provided by the cross-
// platform compatibility library webrtc-adaptor.js (from:
// https://code.google.com/p/webrtc/source/browse/stable/samples/js/base/adapter.js)
module WebRtc {

  export interface PeerConnectionConfig {
    webrtcPcConfig         :RTCPeerConnectionConfig;
    webrtcMediaConstraints :RTCMediaConstraints;
    peerName               ?:string;   // For debugging
    initiateConnection     ?:boolean;  // defaults to false
  }

  export enum SignalType {
    OFFER, ANSWER, CANDIDATE, NO_MORE_CANDIDATES
  }

  export interface SignallingMessage {
    // CONSIDER: use string-enum when typescript supports it.
    type          :SignalType
    // The |candidate| parameter us set iff type === CANDIDATE
    candidate     ?:RTCIceCandidateInit;
    // The |description| parameter is set iff type === OFFER or
    // type === ANSWER
    description   ?:RTCSessionDescriptionInit;
  }

  // Possible candidate types, e.g. RELAY if a host is only accessible
  // via a TURN server. The values are taken from this file; as the comment
  // suggests, not all values may be found in practice:
  //   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/libjingle/source/talk/p2p/base/port.cc
  export enum CandidateType {
    UNKNOWN, LOCAL, STUN, PRFLX, RELAY
  }

  var candidateTypeMapping_ :{[name:string]:CandidateType} = {
    'local': CandidateType.LOCAL,
    'stun': CandidateType.STUN,
    'prflx': CandidateType.PRFLX,
    'relay': CandidateType.RELAY
  }

  // This should match the uproxy-networking/network-typings/communications.d.ts
  // type with the same name (Net.Endpoint).
  export interface Endpoint {
    address:string; // IPv4, IPv6, or domain name.
    port:number;
  }

  // Once you are connected to the peer, you know the local/remote addresses.
  export interface ConnectionAddresses {
    local  :Endpoint;  // the local transport address/port
    localType: CandidateType;
    remote :Endpoint;  // the remote peer's transport address/port
    remoteType: CandidateType;
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
  //   4. (callback) -> pc_.onsignalingstatechange -> onSignallingStateChange_
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
  //   3. (callback) -> pc_.onsignalingstatechange -> onSignallingStateChange_
  //      3.1. completeConnection_ -> pc_.getStats
  //      3.3. [Fulfill onceConnected]
  export class PeerConnection {

    // Name for debugging.
    public peerName     :string;

    // The WebRtc peer connection.
    private pc_            :RTCPeerConnection;
    // All WebRtc data channels associated with this data peer.
    public dataChannels     :{[channelLabel:string] : DataChannel};

    // Internal promise completion functions for the |onceConnecting|,
    // |onceConnected| and |onceDisconnected| promises. Must only be
    // called once (per respective promise).
    private fulfillConnecting_    : () => void;
    private fulfillConnected_     :(addresses:ConnectionAddresses) => void;
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
    public onceConnected  :Promise<ConnectionAddresses>;
    // Fulfilled when disconnected. Will never reject.
    public onceDisconnected :Promise<void>;

    // Queue of channels opened up by the remote peer.
    public peerOpenedChannelQueue :Handler.Queue<DataChannel,void>;

    // Signals to be send to the remote peer by this peer.
    public signalForPeerQueue :Handler.Queue<SignallingMessage,void>;
    public fromPeerCandidateQueue :Handler.Queue<RTCIceCandidate,void>;

    // https://code.google.com/p/webrtc/issues/detail?id=3778
    private closeWorkaroundIndex_ = 0;

    // if |createOffer| is true, the consturctor will immidiately initiate
    // negotiation.
    constructor(private config_ :PeerConnectionConfig) {
      if (config_.webrtcPcConfig === undefined ||
        config_.webrtcMediaConstraints === undefined) {
        throw new Error('must specify peerconnection config and constraints');
      }

      this.peerName = this.config_.peerName ||
          'unnamed-pc-' + Crypto.randomUint32();

      this.onceConnecting = new Promise<void>((F,R) => {
          this.fulfillConnecting_ = F;
        });
      this.onceConnected = new Promise<ConnectionAddresses>((F,R) => {
          // This ensures that onceConnecting consequences happen before
          // onceConnected.
          this.fulfillConnected_ = (addresses:ConnectionAddresses) => {
              this.onceConnecting.then(F.bind(null,addresses));
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
      this.fromPeerCandidateQueue = new Handler.Queue<RTCIceCandidate,void>();

      // This state variable is an abstraction of the PeerConnection state that
      // simplifies usage and management of state.
      this.pcState = State.WAITING;

      this.dataChannels = {};

      this.pc_ = new RTCPeerConnection(this.config_.webrtcPcConfig,
                                       this.config_.webrtcMediaConstraints);
      // Add basic event handlers.
      this.pc_.onicecandidate = ((event:RTCIceCandidateEvent) => {
          if(event.candidate) {
            this.signalForPeerQueue.handle({
                type: SignalType.CANDIDATE,
                candidate: { candidate: event.candidate.candidate,
                             sdpMid: event.candidate.sdpMid,
                             sdpMLineIndex: event.candidate.sdpMLineIndex }
              });
            } else {
              this.signalForPeerQueue.handle(
                  { type: SignalType.NO_MORE_CANDIDATES });
            }
        });
      this.pc_.onnegotiationneeded = () => {
        this.negotiateConnection_().catch((e:Error) => {
          log.error(this.peerName + ': negotiateConnection: ' + e.toString() +
              '; this.toString()= ' + this.toString());
        });
      }
      this.pc_.ondatachannel = this.onPeerStartedDataChannel_;
      this.pc_.onsignalingstatechange = this.onSignallingStateChange_;

      if(this.config_.initiateConnection) {
        this.negotiateConnection().catch((e:Error) => {
          log.error(this.peerName + ': negotiateConnection: ' + e.toString() +
            '; this.toString()= ' + this.toString());
        });
      }
    }

    // Promise wrappers for async WebRtc calls that return the session
    // description that should be set as the local description and sent to the
    // peer.
    private createOffer_ = () : Promise<RTCSessionDescription> => {
      return new Promise((F,R) => { this.pc_.createOffer(F, R); });
    }
    private createAnswer_ = () : Promise<RTCSessionDescription> => {
      return new Promise((F,R) => { this.pc_.createAnswer(F, R); });
    }
    // Setting the local description will be followed by sending the SDP message
    // to the peer, so we return the description value here.
    private setLocalDescription_ = (d:RTCSessionDescription)
        : Promise<RTCSessionDescription> => {
      return new Promise((F,R) => {
            this.pc_.setLocalDescription(d,
              () => { F(d); log.debug(this.peerName + ': ' + 'setLocalDescription'); },
              R);
          });
    }
    // The |setRemoteDescription_| returns a void promise because we don't need
    // to do anything with the remote description once it has been set.
    private setRemoteDescription_ = (d:RTCSessionDescription)
        : Promise<void> => {
      return new Promise<void>((F,R) => {
          this.pc_.setRemoteDescription(d,
            () => { F(); log.debug(this.peerName + ': ' + 'setRemoteDescription'); },
            R);
        });
    }
    // add an ice candidate, promise is for when it is added.
    private addIceCandidate_ = (c:RTCIceCandidate) : Promise<void> => {
      return new Promise<void>((F,R) => {
          try { this.pc_.addIceCandidate(c, F, R); }
          catch(e) { R(e); }
        });
    };

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

      if (this.pc_.signalingState !== 'closed') {
        // Note is expected to invoke |onSignallingStateChange_|
        this.pc_.close();
      }
    }

    private closeWithError_ = (s:string) : void => {
      log.error(this.peerName + ': ' + s);
      if (this.pcState === State.CONNECTING) {
        this.rejectConnected_(new Error(s));
      }
      this.pcState = State.DISCONNECTED;
      this.fulfillDisconnected_();
      if (this.pc_.signalingState !== 'closed') {
        // Note is expected to invoke |onSignallingStateChange_|
        this.pc_.close();
      }
    }

    // The RTCPeerConnection signalingState has changed. This state change is
    // the result of either setLocalDescription() or setRemoteDescription()
    // being invoked. Or it can happen when the peer connection gets
    // unexpectedly closed down.
    private onSignallingStateChange_ = () : void => {
      if (this.pc_.signalingState === 'closed') {
        this.close();
        return;
      }

      if (this.pc_.signalingState === 'stable' &&
          this.pcState === State.CONNECTED) {
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
              State[this.pcState] +
              ' with pc_.signallingState: ' + this.pc_.signalingState);
        return;
      }

      // The only change we care about is getting to stable, which means we are
      // connected. Assumes: |this.pcState === State.CONNECTING| (from above)
      if (this.pc_.signalingState === 'stable') {
        this.completeConnection_();
      }
    }

    // Once we have connected, we need to fulfill the connection promise and set
    // the state. This also involves getting stats on WebRtc so we know what the
    // connection addresses are so the onceConnected and negotiate connection
    // promises can be fulfilled with the addresses.
    private completeConnection_ = () : void => {
      getPeerConnectionStats(this.pc_)
      .then((stats: {local: Endpoint;
                     remote: Endpoint;
                     localType:string;
                     remoteType:string;}) => {
        var addresses : ConnectionAddresses = {
          local: stats.local,
          remote: stats.remote,
          localType: (candidateTypeMapping_[stats.localType]
                               || CandidateType.UNKNOWN),
          remoteType: (candidateTypeMapping_[stats.remoteType]
                               || CandidateType.UNKNOWN)
        };
        this.pcState = State.CONNECTED;
        this.fulfillConnected_(addresses);
      })
      .catch((e) => {
        // Error (unclear from the spec if this can actually happen)
        this.closeWithError_(this.peerName + ': ' +
          'onSignallingStateChange getStats error: ' + e.toString());
      });
    }

    public negotiateConnection =  () : Promise<ConnectionAddresses> => {
      // In order for the initial SDP header to include the provision for having
      // data channels (without it, we would have to re-negotiate SDP after the
      // PC is established), we start negotaition by openning a data channel to
      // the peer, this triggers the negotiation needed event.
      var d = this.openDataChannel('');
      return d.onceOpened.then(() => { return this.onceConnected; });
    }

    // Called when openDataChannel is called to and we have not yet negotiated
    // our connection, or called when some WebRTC internal event requires
    // renegotiation of SDP headers.
    private negotiateConnection_ = () : Promise<ConnectionAddresses> => {
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

      // TODO: fix/remove this when Chrome issue is fixed. This code is a bit
      // of a hack to simply reset the same local and remote description which
      // will trigger the appropriate data channel open event. This can happen
      // in State.CONNECTING to State.CONNECTED.
      //
      // This workaround will cause legitimate renegotation to fail (e.g. for
      // when your local IP/port changes). However that's rather rare.
      //
      // Negotiation messages are falsely requested for new data channels.
      //   https://code.google.com/p/webrtc/issues/detail?id=2431
      if (this.pc_.localDescription && this.pc_.remoteDescription) {
        var localDescription = this.pc_.localDescription;
        var remoteDescription = this.pc_.localDescription;
        // TODO: remove when we are using a good version of chrome.
        log.debug(this.peerName + ': ' + 'negotiateConnection_: dodging.');
        return this.onceConnected;
      }

      // CONSIDER: might we ever need to re-create an onAnswer? Exactly how/when
      // do onnegotiation events get raised? Do they get raised on both sides?
      // Or only for the initiator?
      if (this.pcState === State.WAITING || this.pcState == State.CONNECTED) {
        this.pcState = State.CONNECTING;
        this.fulfillConnecting_();
        this.createOffer_()
          .then(this.setLocalDescription_)
          .then((d:RTCSessionDescription) => { this.signalForPeerQueue.handle(
              {type: SignalType.OFFER,
               description: {type: d.type, sdp: d.sdp} });
            })
          .catch((e) => {
              this.closeWithError_('Failed to set local description: ' +
                  e.toString());
            });
        return this.onceConnected;
      }
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
          if(this.pc_.signalingState === 'have-local-offer' &&
              stringHash(JSON.stringify(signal.description.sdp)) <
                  stringHash(JSON.stringify(this.pc_.localDescription.sdp))) {
            // TODO: implement reset and use their offer.
            this.closeWithError_('Simultainious offers not yet implemented.');
            return;
          }
          this.pcState = State.CONNECTING;
          this.fulfillConnecting_();
          var remoteDescription :RTCSessionDescription =
              new RTCSessionDescription(signal.description);
          this.setRemoteDescription_(remoteDescription)  // initial offer from peer
              .then(this.createAnswer_)
              .then(this.setLocalDescription_)
              .then((d:RTCSessionDescription) => {
                  this.signalForPeerQueue.handle(
                      {type: SignalType.ANSWER,
                       description: {type: d.type, sdp: d.sdp} });
                })
              .then(() => {
                  this.fromPeerCandidateQueue.setHandler(this.addIceCandidate_);
                })
              .catch((e) => {
                  this.closeWithError_('Failed to connect to offer:' +
                      e.toString());
                });
          break;
         // Answer to an offer we sent
        case SignalType.ANSWER:
          var remoteDescription :RTCSessionDescription =
              new RTCSessionDescription(signal.description);
          this.setRemoteDescription_(remoteDescription)
              .then(() => {
                  this.fromPeerCandidateQueue.setHandler(this.addIceCandidate_);
                })
              .catch((e) => {
                  this.closeWithError_('Failed to set remote description: ' +
                      ': ' +  JSON.stringify(remoteDescription) + ' (' +
                      typeof(remoteDescription) + '); Error: ' + e.toString());
                });
          break;
        // Add remote ice candidate.
        case SignalType.CANDIDATE:
          // CONSIDER: Should we be passing/getting the SDP line index?
          // e.g. https://code.google.com/p/webrtc/source/browse/stable/samples/js/apprtc/js/main.js#331
          try {
            this.fromPeerCandidateQueue.handle(
                new RTCIceCandidate(signal.candidate));
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
                              options?:RTCDataChannelInit)
        : DataChannel => {
      log.debug(this.peerName + ': ' + 'openDataChannel: ' + channelLabel +
          '; options=' + JSON.stringify(options));

      // https://code.google.com/p/webrtc/issues/detail?id=3778
      if (options !== undefined) {
        if (!('id' in options)) {
          options.id = this.closeWorkaroundIndex_++;
        }
      } else {
        options = { id: this.closeWorkaroundIndex_++ };
      }
      var rtcDataChannel = this.pc_.createDataChannel(channelLabel, options);

      // Firefox does not fire the |'negotiationneeded'| event, so we need to
      // negotate here if we are not connected. See
      // https://bugzilla.mozilla.org/show_bug.cgi?id=840728
      // TODO: Remove when Firefox supports it.
      if (typeof mozRTCPeerConnection !== 'undefined' &&
          this.pcState === State.WAITING) {
        this.negotiateConnection_();
      }

      var dataChannel = this.addRtcDataChannel_(rtcDataChannel);
      return dataChannel;
    }

    // When a peer creates a data channel, this function is called with the
    // |RTCDataChannelEvent|. We then create the data channel wrapper and add
    // the new |DataChannel| to the |this.peerOpenedChannelQueue| to be
    // handled.
    private onPeerStartedDataChannel_ =
        (rtcDataChannelEvent:RTCDataChannelEvent) : void => {
      log.debug(this.peerName + ': ' + 'onPeerStartedDataChannel: ' +
          rtcDataChannelEvent.channel.label);
      this.peerOpenedChannelQueue.handle(
          this.addRtcDataChannel_(rtcDataChannelEvent.channel));
    }

    // Add a rtc data channel and return the it wrapped as a DataChannel
    private addRtcDataChannel_ = (rtcDataChannel:RTCDataChannel)
        : DataChannel => {
      var dataChannel :DataChannel = new DataChannel(rtcDataChannel);
      this.dataChannels[dataChannel.getLabel()] = dataChannel;
      dataChannel.onceClosed.then(() => {
          delete this.dataChannels[dataChannel.getLabel()];
        });
      return dataChannel;
    }

    // For debugging: prints the state of the peer connection including all
    // associated data channels.
    public toString = () : string => {
      var s :string = this.peerName + ' (' + this.pc_.signalingState +
          '): { \n';
      var channelLabel :string;
      for (channelLabel in this.dataChannels) {
        s += '  ' + channelLabel + ': ' +
            this.dataChannels[channelLabel].toString() + '\n';
      }
      s += '}';
      return s;
    }
  }  // class PeerConnection

}  // module WebRtc
