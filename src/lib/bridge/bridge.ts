/// <reference path='../../../../third_party/typings/browser.d.ts' />

import churn = require('../churn/churn');
import churn_types = require('../churn/churn.types');
import handler = require('../handler/queue');
import logging = require('../logging/logging');
import peerconnection = require('../webrtc/peerconnection');
import peerconnection_types = require('../webrtc/signals');
import xchurn = require('../churn/xwalk');

declare const freedom: freedom.FreedomInModuleEnv;

var log :logging.Log = new logging.Log('bridge');

////////
// Static constructors.
////////

// Use this if you think the remote peer supports bridging but
// you don't want to use obfuscation.
export var preObfuscation = (
    name?:string,
    config?:freedom.RTCPeerConnection.RTCConfiguration,
    portControl?:freedom.PortControl.PortControl)
    :BridgingPeerConnection => {
  return new BridgingPeerConnection(ProviderType.PLAIN, name, config,
                                    portControl);
}

// Use this if you think the remote peer supports obfuscation.
export var basicObfuscation = (
    name?:string,
    config?:freedom.RTCPeerConnection.RTCConfiguration,
    portControl?:freedom.PortControl.PortControl,
    transformerConfig?:churn_types.TransformerConfig)
    :BridgingPeerConnection => {
  return new BridgingPeerConnection(ProviderType.CHURN, name, config,
                                    portControl, transformerConfig);
}

// Use this if you think the remote peer supports holographic ICE.
export var holographicIceOnly = (
    name?:string,
    config?:freedom.RTCPeerConnection.RTCConfiguration,
    portControl?:freedom.PortControl.PortControl,
    transformerConfig?:churn_types.TransformerConfig)
    :BridgingPeerConnection => {
  return new BridgingPeerConnection(ProviderType.HOLO_ICE,
                                    name, config, portControl,
                                    transformerConfig);
}

// Creates a bridge which initiates with the best provider and can
// accept an offer from any of the provider types known to this
// bridge. Use this for convenience or or when you will not be initiating.
export var best = holographicIceOnly;

////////
// Signalling messages (wire protocol).
////////

// Wraps the signals of one or more concrete PeerConnection providers.
export interface SignallingMessage {
  // One or more signalling messages, for one or more concrete
  // PeerConnection providers. The remote bridge should select
  // a provider and respond with signalling messages from that.
  // The ability to "batch" multiple signalling messages into one
  // may be useful in copypaste-type scenarios, although note
  // that this class does not itself perform any batching.
  signals?: { [providerName: string]: Object[] };

  // Currently just a coarse-grained indication that there was an error
  // processing the previous message, most likely because no supported
  // provider was found.
  errorOnLastMessage ?:boolean;

  // If present, indicates that this message is first in a round of
  // signaling messages.
  first ?:boolean;
}

////////
// Static helper functions.
////////

// Returns true iff message is a "terminating" message,
// i.e. NO_MORE_CANDIDATES. This is intended for use in copy/paste
// scenarios where it's important for the caller to know when
// signalling is complete. Handles all providers known to the bridge
// but does *not* handle "flattened" signalling messages, nor
// messages with multiple providers.
export var isTerminatingSignal = (message:SignallingMessage) : boolean => {
  if (message.signals === undefined) {
    return false;
  }
  var keys = Object.keys(message.signals);
  if (keys.length !== 1) {
    throw new Error('only one provider supported');
  }
  var providerName = keys[0];
  var signals = message.signals[providerName];
  if (signals.length !== 1) {
    throw new Error('only one signal supported');
  }
  switch (providerName) {
    case ProviderType[ProviderType.PLAIN]:
      var oldSignal = <peerconnection_types.Message>signals[0];
      return oldSignal.type === peerconnection_types.Type.NO_MORE_CANDIDATES;
    case ProviderType[ProviderType.CHURN]:
    case ProviderType[ProviderType.HOLO_ICE]:
      var churnSignal = <churn_types.ChurnSignallingMessage>signals[0];
      return churnSignal.webrtcMessage && churnSignal.webrtcMessage.type ===
          peerconnection_types.Type.NO_MORE_CANDIDATES;
    default:
      throw new Error('no supported provider type found');
  }
}

// Constructs a signalling message suitable for the initial offer.
// Public for testing.
export var makeSingleProviderMessage = (
    providerType:ProviderType,
    signals:Object[]) : SignallingMessage => {
  var message :SignallingMessage = {
    signals: {}
  };
  message.signals[ProviderType[providerType]] = signals;
  return message;
}

// Finds the "best" provider offered within a set of batched signals, throwing
// if none is found. Currently, churn is favoured.
// Public for testing.
export var pickBestProviderType = (
    signals ?:{[providerName:string] : Object[]}) : ProviderType => {
  if (ProviderType[ProviderType.HOLO_ICE] in signals) {
    return ProviderType.HOLO_ICE;
  } else if (ProviderType[ProviderType.CHURN] in signals) {
    return ProviderType.CHURN;
  } else if (ProviderType[ProviderType.PLAIN] in signals) {
    return ProviderType.PLAIN;
  }
  throw new Error('no supported provider found');
}

////////
// The class itself.
////////

// Exported for constructor of exported class.
// Keep these short to help reduce the length of signalling channel messages.
export enum ProviderType {
  PLAIN,
  CHURN,
  HOLO_ICE
}

// Establishes connectivity with the help of a variety of peerconnection
// providers.
//
// This early iteration has two key characteristics:
//  - an offer includes *one* provider, its type chosen at construction time
//  - to answer, *one* provider will be selected
//
// At some point in the future we will want to extend these messages, e.g.
// including >1 provider in offers and describing the protocol between
// SocksToRtc and RtcToNet. To preserve backwards compatibility, we should
// strive to always support the initial offer case here, which will pick one
// of the CHURN or PLAIN provider.
export class BridgingPeerConnection implements peerconnection.PeerConnection<
    SignallingMessage> {

  // Number of instances created, for logging purposes.
  private static id_ = 0;

  // Equivalent to the negotiated provider's onceConnected field unless close
  // is called before negotiation happens, in which case it rejects immediately.
  private connected_ :() => void;
  private rejectConnected_ :(e:Error) => void;
  public onceConnected :Promise<void> = new Promise<void>((F, R) => {
    this.connected_ = F;
    this.rejectConnected_ = R;
  });

  // Equivalent to the negotiated provider's onceConnected field unless close
  // is called before negotiation happens, in which case this fulfills
  // immediately.
  private closed_ :() => void;
  public onceClosed :Promise<void> = new Promise<void>((F, R) => {
    this.closed_ = F;
  });

  public peerOpenedChannelQueue =
      new handler.Queue<peerconnection.DataChannel, void>();

  public signalForPeerQueue =
      new handler.Queue<SignallingMessage, void>();

  // Negotiated, actual, provider type.
  private providerType_: ProviderType;

  private provider_ :peerconnection.PeerConnection<any>;

  // True until a signalling message has been sent.
  // Used to set the first field in signalling messages.
  private first_ = true;

  // Private, use the static constructors instead.
  constructor(
      private preferredProviderType_ :ProviderType,
      private name_ :string = 'unnamed-bridge-' + BridgingPeerConnection.id_,
      private config_ ?:freedom.RTCPeerConnection.RTCConfiguration,
      private portControl_ ?:freedom.PortControl.PortControl,
      private transformerConfig_ ?:churn_types.TransformerConfig) {
    BridgingPeerConnection.id_++;
  }

  public negotiateConnection = () : Promise<void> => {
    log.info('%1: negotiating, offering %2 provider',
        this.name_, ProviderType[this.preferredProviderType_]);
    this.bridgeWith_(
        this.preferredProviderType_,
        this.makeFromProviderType_(this.preferredProviderType_));
    return this.provider_.negotiateConnection();
  }

  private makeFromProviderType_ = (
      type:ProviderType) : peerconnection.PeerConnection<any> => {
    var pc :freedom.RTCPeerConnection.RTCPeerConnection =
        freedom['core.rtcpeerconnection'](this.config_);
    switch (type) {
      case ProviderType.PLAIN:
        return this.makePlain_(pc);
      case ProviderType.CHURN:
        return this.makeChurn_(pc);
      case ProviderType.HOLO_ICE:
        return this.makeHolographicIceOnly_(pc);
      default:
        throw new Error('unknown provider type ' + type);
    }
  }

  // Factored out for mocking purposes.
  private makePlain_ = (
      pc:freedom.RTCPeerConnection.RTCPeerConnection)
      : peerconnection.PeerConnection<peerconnection_types.Message> => {
    log.debug('%1: constructing plain peerconnection', this.name_);
    return new peerconnection.PeerConnectionClass(pc, this.name_);
  }

  // Factored out for mocking purposes.
  private makeChurn_ = (
      pc:freedom.RTCPeerConnection.RTCPeerConnection)
      :peerconnection.PeerConnection<churn_types.ChurnSignallingMessage> => {
    log.debug('%1: constructing churn peerconnection', this.name_);
    return new churn.Connection(pc, this.name_, undefined,
        this.portControl_, this.transformerConfig_);
  }

  // Factored out for mocking purposes.
  private makeHolographicIceOnly_ = (
      pc:freedom.RTCPeerConnection.RTCPeerConnection)
      :peerconnection.PeerConnection<churn_types.ChurnSignallingMessage> => {
    log.debug('%1: constructing holographic ICE peerconnection', this.name_);
    if (typeof navigator !== 'undefined' &&
        navigator.userAgent.indexOf('Android') !== -1) {
      return new xchurn.Connection(pc, this.name_, true,
          this.portControl_, this.transformerConfig_);
    }
    return new churn.Connection(pc, this.name_, true,
        this.portControl_, this.transformerConfig_);
  }

  // Configures the bridge with this provider by forwarding the provider's
  // handler queues and promises.
  private bridgeWith_ = (
      providerType:ProviderType,
      provider:peerconnection.PeerConnection<Object>) : void => {
    // Forward queues, wrapping signals.
    provider.signalForPeerQueue.setSyncHandler((signal: Object) => {
      var wrappedSignal = this.wrapSignal_(signal);
      this.signalForPeerQueue.handle(wrappedSignal);
    });
    provider.peerOpenedChannelQueue.setHandler(
        this.peerOpenedChannelQueue.handle);

    // Forward promises.
    provider.onceConnected.then(this.connected_, this.rejectConnected_);
    provider.onceClosed.then(this.closed_);

    this.providerType_ = providerType;
    this.provider_ = provider;

    log.debug('%1: now bridging with %2 provider',
        this.name_, ProviderType[this.providerType_]);
  }

  private wrapSignal_ = (signal:Object) : SignallingMessage => {
    var message = makeSingleProviderMessage(this.providerType_, [signal]);
    if (this.first_) {
      message.first = true;
      this.first_ = false;
    }
    return message;
  }

  // Unbatches the signals and forwards them to the current provider,
  // first creating a provider if necessary.
  public handleSignalMessage = (message:SignallingMessage) : void => {
    log.debug('%1: handling signal: %2', this.name_, message);

    try {
      if (this.provider_ === undefined) {
        var providerType = pickBestProviderType(message.signals);
        log.debug('%1: received offer, responding with %2 provider',
            this.name_, ProviderType[providerType]);
        this.bridgeWith_(
            providerType,
            this.makeFromProviderType_(providerType));
      }

      // Unbatch and forward signals to the concrete provider.
      if (ProviderType[this.providerType_] in message.signals) {
        message.signals[ProviderType[this.providerType_]].forEach(
            this.provider_.handleSignalMessage);
      } else {
        throw new Error('cannot find signals for current provider');
      }
    } catch (e) {
      this.signalForPeerQueue.handle({
        errorOnLastMessage: true
      });
    }
  }

  public openDataChannel = (channelLabel:string,
      options?:freedom.RTCPeerConnection.RTCDataChannelInit)
      : Promise<peerconnection.DataChannel> => {
    if (this.provider_ === undefined) {
      throw new Error('cannot open channel before provider has been created');
    }
    return this.provider_.openDataChannel(channelLabel, options);
  }

  public close = () : Promise<void> => {
    if (this.provider_ === undefined) {
      this.rejectConnected_(new Error('closed before negotiation succeeded'));
      this.closed_();
    } else {
      this.provider_.close();
    }
    return this.onceClosed;
  }
}
