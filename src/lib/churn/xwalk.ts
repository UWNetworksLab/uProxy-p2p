/// <reference path='../../../third_party/typings/index.d.ts' />

import caesar = require('../transformers/caesar');
import candidate = require('../churn/candidate');
import churn_types = require('../churn/churn.types');
import handler = require('../handler/queue');
import logging = require('../logging/logging');
import peerconnection = require('../webrtc/peerconnection');
import random = require('random-lib');
import signals = require('../webrtc/signals');

import Candidate = candidate.Candidate;

import ChurnSignallingMessage = churn_types.ChurnSignallingMessage;
import TransformerConfig = churn_types.TransformerConfig;

var log :logging.Log = new logging.Log('xchurn');

// Generates a key suitable for use with CaesarCipher, viz. 1-255.
var generateCaesarConfig_ = (): caesar.Config => {
  return {
    key: random.randomInt({
      min: 1,
      max: 255
    })
  };
}

/**
 * A CHURN implementation that works when running in a modified crosswalk
 * runtimes that includes built-in caesar cipher support.
 * This class only supports the 'caesar' obfuscator.  The caesar parameter is
 * communicated to the browser by inserting it into the localDescription SDP.
 */
export class Connection implements peerconnection.PeerConnection<ChurnSignallingMessage> {

  // Number of instances created, for logging purposes.
  private static id_ = 0;

  // The "mid" 
  private mid_ :string;

  public peerOpenedChannelQueue :handler.QueueHandler<peerconnection.DataChannel, void>;
  public signalForPeerQueue :handler.Queue<ChurnSignallingMessage, void>;

  public onceConnected :Promise<void>;
  public onceClosed :Promise<void>;

  private pc_ :peerconnection.PeerConnectionClass;

  // Fulfills once we know the obfuscator config, which may
  // happen in response to a signalling channel message.
  private haveTransformerConfig_ :(config:TransformerConfig) => void;
  private onceHaveTransformerConfig_ = new Promise((F, R) => {
    this.haveTransformerConfig_ = F;
  });

  constructor(rtcPc:freedom.RTCPeerConnection.RTCPeerConnection,
              private name_ = 'unnamed-xchurn-' + Connection.id_,
              private skipPublicEndpoint_?:boolean,
              private portControl_?:freedom.PortControl.PortControl,
              private preferredTransformerConfig_?:TransformerConfig) {
    Connection.id_++;

    this.signalForPeerQueue = new handler.Queue<ChurnSignallingMessage,void>();
    this.configureConnection_(rtcPc);

    // Forward onceXxx promises.
    this.onceConnected = this.pc_.onceConnected;
    this.onceClosed = this.pc_.onceClosed;
  }

  private configureConnection_ = (
      freedomPc:freedom.RTCPeerConnection.RTCPeerConnection) => {
    this.pc_ = new peerconnection.PeerConnectionClass(
        freedomPc, this.name_);

    // This will insert the caesar shift key
    this.pc_.mungeLocalDescription = this.mungeLocalSdp_;

    this.peerOpenedChannelQueue = this.pc_.peerOpenedChannelQueue;

    this.pc_.signalForPeerQueue.setSyncHandler(
        (message:signals.Message) => {
      // TODO: Move this functionality into PeerConnectionClass, so it doesn't
      // have to be copy-pasted here from churn.ts.
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
        }
      }

      var churnSignal :ChurnSignallingMessage = {
        webrtcMessage: message
      };
      this.signalForPeerQueue.handle(churnSignal);
    });
  }

  private mungeLocalSdp_ = (d:freedom.RTCPeerConnection.RTCSessionDescription)
      : Promise<freedom.RTCPeerConnection.RTCSessionDescription> => {
    return this.onceHaveTransformerConfig_.then((tConfig:TransformerConfig) => {
      if (tConfig.name === 'caesar') {
        let caesarConfig :caesar.Config = JSON.parse(tConfig.config);
        d.sdp += 'a=x-uproxy-transform:caesar ' + caesarConfig.key + '\r\n';
      } else {
        log.error('%1: Only caesar is supported, not %2', this.name_,
            tConfig.name);
      }
      return d;
    });
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

    return this.pc_.negotiateConnection();
  }

  // Forward the message to the relevant stage: churn-pipe or obfuscated.
  // In the case of obfuscated signalling channel messages, we inject our
  // local forwarding socket's endpoint.
  public handleSignalMessage = (
      churnMessage:ChurnSignallingMessage) : void => {
    if (churnMessage.publicEndpoint !== undefined) {
      // TODO: re-add legacy compatibility with single-endpoint CHURN.
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
      this.pc_.handleSignalMessage(churnMessage.webrtcMessage);
    }
  }

  public openDataChannel = (channelLabel:string,
      options?:freedom.RTCPeerConnection.RTCDataChannelInit)
      : Promise<peerconnection.DataChannel> => {
    return this.pc_.openDataChannel(channelLabel, options);
  }

  public close = () : Promise<void> => {
    return this.pc_.close();
  }

  public toString = () : string => {
    return 'Wrapper around ' + this.pc_.toString() + ' using modified xwalk';
  };
}
