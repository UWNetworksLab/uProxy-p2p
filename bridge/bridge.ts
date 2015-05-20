/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />

import aggregate = require('../handler/aggregate');
import churn = require('../churn/churn');
import churn_types = require('../churn/churn.types');
import handler = require('../handler/queue');
import logging = require('../logging/logging');
import peerconnection = require('../webrtc/peerconnection');
import peerconnection_types = require('../webrtc/signals');

var log :logging.Log = new logging.Log('bridge');

////////
// Static constructors.
////////

// Creates a bridge which initiates with the best provider and will pair
// with any supported provider. Use this for convenience, or when you
// will not be initiating.
export var best = (
    name?:string,
    config?:freedom_RTCPeerConnection.RTCConfiguration)
    :BridgingPeerConnection => {
  return basicObfuscation(name, config);
}

// Creates a new bridge which only attempts legacy, non-obfuscated,
// peerconnections.
export var legacy = (
    name?:string,
    config?:freedom_RTCPeerConnection.RTCConfiguration)
    :BridgingPeerConnection => {
  return new BridgingPeerConnection(ProviderType.LEGACY, name, config);
}

// Creates a new bridge which attempts to speak obfuscation.
// Use this if you think the remote peer supports it.
export var basicObfuscation = (
    name?:string,
    config?:freedom_RTCPeerConnection.RTCConfiguration)
    :BridgingPeerConnection => {
  return new BridgingPeerConnection(ProviderType.CHURN, name, config);
}

////////
// Signalling messages (wire protocol).
////////

// Wraps and batches the output of one or more concrete PeerConnection
// providers. Generally, just one of these messages needs to be sent by each
// peer in order to establish a connection. This is very useful in
// copypaste-type scenarios.
export interface SignallingMessage {
  // Not actually read by this class but uProxy uses this as a hint
  // one or two places.
  type ?:string;
  // All concrete PeerConnection providers offered by the peer.
  // The remote bridge should select one, indicating its choice in the
  // answer.
  providers ?:Provider[];
}

// BridgingPeerConnection-specific message type.
export enum SignallingMessageType {
  OFFER,
  ANSWER,
  ERROR
}

// Encapsulates a batch of signalling messages from a concrete PeerConnection
// provider. Generally, a batch of signalling messages will be sufficient to
// establish a peerconnection with a peer.
export interface Provider {
  name ?:string;
  signals ?:Object[];
}

////////
// Static helper functions.
////////

// Constructs a signalling message suitable for the initial offer.
// Public for testing.
export var makeSingleProviderMessage = (
    signalType:SignallingMessageType,
    providerType:ProviderType,
    signals:Object[]) : Provider => {
  return {
    type: SignallingMessageType[signalType],
    providers: [
      {
        name: ProviderType[providerType],
        signals: signals
      }
    ]
  };
}

// Finds the first provider listed, throwing if none is found.
// Public for testing.
export var pickBestProvider = (
    providers:Provider[]) : Provider => {
  var legacy: Provider;
  var churn: Provider;
  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i];
    if (provider.name === undefined) {
      continue;
    }
    if (provider.name === ProviderType[ProviderType.LEGACY]) {
      legacy = provider;
    } else if (provider.name === ProviderType[ProviderType.CHURN]) {
      churn = provider;
    }
  }
  if (churn || legacy) {
    return churn || legacy;
  }
  throw new Error('no supported provider found');
}

// Finds the requested provider, throwing if not found.
var findProvider = (
    type:ProviderType,
    providers:Provider[]) : Provider => {
  for (var i = 0; i < providers.length; i++) {
    var provider = providers[i];
    if (provider.name && provider.name === ProviderType[type]) {
      return provider;
    }
  }
  throw new Error('provider ' + ProviderType[type] + ' not found');
}

////////
// Signalling message batching for concrete providers.
////////

// Public for testing.
export class LegacySignalAggregator implements aggregate.Aggregator<
    peerconnection_types.Message,
    peerconnection_types.Message[]> {
  private signals_ :peerconnection_types.Message[] = [];
  private haveNoMoreCandidates_ = false;

  public input = (signal:peerconnection_types.Message) => {
    this.signals_.push(signal);
    this.haveNoMoreCandidates_ = this.haveNoMoreCandidates_ || (
        signal.type &&
        signal.type === peerconnection_types.Type.NO_MORE_CANDIDATES);
  }

  public check = () => {
    if (this.haveNoMoreCandidates_) {
      var batch = this.signals_;
      this.signals_ = [];
      this.haveNoMoreCandidates_ = false;
      return batch;
    }
    return null;
  }
}

// Public for testing.
export class ChurnSignalAggregator implements aggregate.Aggregator<
    churn_types.ChurnSignallingMessage,
    churn_types.ChurnSignallingMessage[]> {
  private signals_ :churn_types.ChurnSignallingMessage[] = [];
  private haveNoMoreCandidates_ = false;
  private haveEndpoint_ = false;

  public input = (signal:churn_types.ChurnSignallingMessage) => {
    this.signals_.push(signal);
    this.haveNoMoreCandidates_ = this.haveNoMoreCandidates_ || (
        signal.webrtcMessage &&
        signal.webrtcMessage.type &&
        signal.webrtcMessage.type === peerconnection_types.Type.NO_MORE_CANDIDATES);
    this.haveEndpoint_ = this.haveEndpoint_ ||
        (signal.publicEndpoint !== undefined);
  }

  public check = () => {
    if (this.haveNoMoreCandidates_ && this.haveEndpoint_) {
      var batch = this.signals_;
      this.signals_ = [];
      this.haveNoMoreCandidates_ = false;
      this.haveEndpoint_ = false;
      return batch;
    }
    return null;
  }
}

////////
// The class itself.
////////

// Exported for constructor of exported class.
export enum ProviderType {
  LEGACY,
  CHURN
}

enum BridgingState {
  NEW,
  INITIATING,
  ANSWERING
}

// Establishes connectivity with the help of a variety of peerconnection
// providers, batching signalling messages for the benefit of copypaste
// scenarios.
//
// This early iteration has two key characteristics:
//  - an offer includes *one* provider, its type chosen at construction time
//  - to answer, *one* provider will be selected
//
// At some point in the future we will want to extend these messages, e.g.
// including >1 provider in offers and describing the protocol between
// SocksToRtc and RtcToNet. To preserve backwards compatibility, we should
// strive to always support the initial offer case here, which will pick one
// of the CHURN or LEGACY provider.
//
// TODO: Pass non-bridging signalling messages through, to support old clients.
// TODO: Batching complicates a few things here and it's so useful that it
//       probably should just be pushed up to the PeerConnection interface.
export class BridgingPeerConnection implements peerconnection.PeerConnection<
    SignallingMessage> {

  // Number of instances created, for logging purposes.
  private static id_ = 0;

  // TODO: remove these public fields from the interface
  public pcState :peerconnection.State;
  public dataChannels :{[label:string] : peerconnection.DataChannel};

  // This is hazily defined by the superclass: roughly, it fulfills when the
  // peer has made or received an offer -- and there are several cases in which
  // it never fulfills, e.g. close is called before connection is established.
  // Here, it fulfills once a provider has been created, i.e.:
  //  1. negotiateConnection is called
  //  2. a *valid* offer is received
  private connecting_ :() => void;
  public onceConnecting: Promise<void> = new Promise<void>((F, R) => {
    this.connecting_ = F;
  });

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

  private state_: BridgingState = BridgingState.NEW;

  // Private, use the static constructors instead.
  constructor(
      private preferredProviderType_ :ProviderType,
      private name_ :string = 'unnamed-bridge-' + BridgingPeerConnection.id_,
      private config_ ?:freedom_RTCPeerConnection.RTCConfiguration) {
    BridgingPeerConnection.id_++;

    // Some logging niceties.
    this.onceConnecting.then(() => {
      log.debug('%1: now bridging (current state: %2)',
          this.name_, BridgingState[this.state_]);
    });
  }

  public negotiateConnection = () : Promise<void> => {
    log.debug('%1: negotiating, offering %2 provider',
        this.name_, ProviderType[this.preferredProviderType_]);
    this.state_ = BridgingState.INITIATING;
    this.bridgeWith_(
        this.preferredProviderType_,
        this.makeFromProviderType_(this.preferredProviderType_));
    return this.provider_.negotiateConnection();
  }

  private makeFromProviderType_ = (
      type:ProviderType) : peerconnection.PeerConnection<any> => {
    if (type !== ProviderType.LEGACY && type !== ProviderType.CHURN) {
      throw new Error('unknown provider type ' + type);
    }

    var pc :freedom_RTCPeerConnection.RTCPeerConnection =
        freedom['core.rtcpeerconnection'](this.config_);
    return type === ProviderType.LEGACY ?
        this.makeLegacy_(pc) :
        this.makeChurn_(pc);
  }

  // Factored out for mocking purposes.
  private makeLegacy_ = (
      pc:freedom_RTCPeerConnection.RTCPeerConnection)
      : peerconnection.PeerConnection<peerconnection_types.Message> => {
    log.debug('%1: constructing legacy peerconnection', this.name_);
    return new peerconnection.PeerConnectionClass(pc, this.name_);
  }

  // Factored out for mocking purposes.
  private makeChurn_ = (
      pc:freedom_RTCPeerConnection.RTCPeerConnection)
      : peerconnection.PeerConnection<churn_types.ChurnSignallingMessage> => {
    log.debug('%1: constructing churn peerconnection', this.name_);
    return new churn.Connection(pc, this.name_);
  }

  // Configures the bridge with this provider by establishing setting queue
  // forwarding, signal batching, and fulfilling onceBridging_.
  // State is *not* set here: that depends on whether we're initiating or
  // answering.
  private bridgeWith_ = (
      providerType:ProviderType,
      provider:peerconnection.PeerConnection<Object>) : void => {
    var batcher = aggregate.createAggregateHandler(
        this.makeBatcher_(providerType));
    batcher.nextAggregate().then((batchedSignals) => {
      this.signalForPeerQueue.handle(makeSingleProviderMessage(
          this.state_ === BridgingState.INITIATING ?
              SignallingMessageType.OFFER :
              SignallingMessageType.ANSWER,
          providerType,
          batchedSignals));
    });
    provider.signalForPeerQueue.setSyncHandler(batcher.handle);

    // Forward new channel queue.
    provider.peerOpenedChannelQueue.setHandler(
        this.peerOpenedChannelQueue.handle);

    // Forward promises.
    provider.onceConnected.then(this.connected_, this.rejectConnected_);
    provider.onceClosed.then(this.closed_);

    this.providerType_ = providerType;
    this.provider_ = provider;

    this.connecting_();
  }

  private makeBatcher_ = (type:ProviderType): aggregate.Aggregator<
      Object, Object[]> => {
    if (type !== ProviderType.LEGACY && type !== ProviderType.CHURN) {
      throw new Error('unknown provider type');
    }
    return type === ProviderType.LEGACY ?
        new LegacySignalAggregator() :
        new ChurnSignalAggregator();    
  }

  // Unbatches the signals and forwards them to the current provider,
  // first creating a provider if necessary.
  public handleSignalMessage = (
      message:SignallingMessage) : void => {
    log.debug('%1: handling signal: %2', this.name_, message);

    try {
      var provider: Provider;
      if (this.state_ === BridgingState.NEW) {
        provider = pickBestProvider(message.providers);
        var providerType = (<any>ProviderType)[provider.name];
        log.debug('%1: received offer, responding with %2 provider',
            this.name_, ProviderType[providerType]);
        this.state_ = BridgingState.ANSWERING;
        this.bridgeWith_(
            providerType,
            this.makeFromProviderType_(providerType));
      } else {
        provider = findProvider(this.providerType_, message.providers);
      }

      // Unbatch the signals and forward to the provider.
      for (var i = 0; i < provider.signals.length; i++) {
        var signal = provider.signals[i];
        log.debug('%1: unbatched signal: %2', this.name_, signal);
        this.provider_.handleSignalMessage(signal);
      }
    } catch (e) {
      this.signalForPeerQueue.handle({
        type: SignallingMessageType[
            SignallingMessageType.ERROR]
      });
    }
  }

  public openDataChannel = (channelLabel:string,
      options?:freedom_RTCPeerConnection.RTCDataChannelInit)
      : Promise<peerconnection.DataChannel> => {
    return this.provider_.openDataChannel(channelLabel, options);
  }

  public close = () : Promise<void> => {
    if (this.state_ === BridgingState.NEW) {
      this.rejectConnected_(new Error('closed before negotiation succeeded'));
      this.closed_();
    } else {
      this.provider_.close();
    }
    return this.onceClosed;
  }
}
