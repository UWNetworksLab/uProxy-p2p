/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../third_party/browserify-zlib/browserify-zlib.d.ts' />

import bridge = require('./bridge');
import churn_types = require('../churn/churn.types');
import logging = require('../logging/logging');
import signals = require('../webrtc/signals');
import zlib = require('browserify-zlib');

var log :logging.Log = new logging.Log('one-time batcher');

// Uncompresses a signal message, as encoded by the Batcher.
// Should be called when you receive a SignalBatcher message
// over the wire and want to forward it to a PeerConnection.
export var decode = (encoded:string) : bridge.SignallingMessage => {
  var decoded = new Buffer(encoded, 'base64');
  var uncompressedBuffer = zlib.gunzipSync(decoded);
  var json = uncompressedBuffer.toString();
  return <bridge.SignallingMessage>JSON.parse(json);
};

// Batches and compresses signalling messages, for use in copy/paste
// scenarios, where size and number of messages are crucial.
// Right now, churn signalling messages are supported and batches are
// delimited by NO_MORE_CANDIDATES messages.
export class SignalBatcher {
  // Number of instances created, for logging purposes.
  private static id_ = 0;

  // Messages received since creation or last NO_MORE_CANDIDATES message.
  private batch_ :bridge.SignallingMessage[] = []

  // Returns true iff message is a "terminating"
  // message, i.e. NO_MORE_CANDIDATES.
  private static isTerminating_ = (message:bridge.SignallingMessage) : boolean => {
    if (bridge.ProviderType[bridge.ProviderType.CHURN] in message.signals ||
        bridge.ProviderType[bridge.ProviderType.HOLO_ICE] in message.signals) {
      var providerSignals = message.signals[Object.keys(message.signals)[0]];
      var churnSignal = <churn_types.ChurnSignallingMessage>providerSignals[0];
      return churnSignal.webrtcMessage &&
          churnSignal.webrtcMessage.type === signals.Type.NO_MORE_CANDIDATES;
    }
    throw new Error('no supported provider type found');
  }

  // "Flattens" the supplied signalling messages into one, batched, message, e.g.:
  //   {
  //     signals: {
  //      'HOLO_ICE': [
  //        {
  //          caesar: 94
  //        }
  //      ]
  //     }
  //   }
  // and
  //   {
  //     signals: {
  //      'HOLO_ICE': [
  //        {
  //          a: 'hello',
  //          b: 'world'
  //        }
  //      ]
  //     }
  //   }
  // flatten to:
  //   {
  //     signals: {
  //      'HOLO_ICE': [
  //        {
  //          caesar: 94
  //        },
  //        {
  //          a: 'hello',
  //          b: 'world'
  //        }
  //      ]
  //     }
  //   }
  //
  // The messages must all have the same provider type.
  // Public for testing.
  public static flatten_ = (
      messages:bridge.SignallingMessage[]) : bridge.SignallingMessage => {
    var providerName = Object.keys(messages[0].signals)[0];

    var result :bridge.SignallingMessage = {
      signals: {},
      first: true
    };
    result.signals[providerName] = messages.map(signal => {
      return signal.signals[providerName][0];
    });

    return result;
  }

  // emitBatch_ will be invoked when a batch is complete with a string
  // which can be sent over the wire and decoded with decode().
  constructor(
      private emitBatch_ :(message:string) => void,
      private name_ :string = 'unnamed-onetime-batcher-' + SignalBatcher.id_) {
    SignalBatcher.id_++;
  }

  // Adds a message to the current batch. If the message looks like a
  // "terminating" message, i.e. NO_MORE_CANDIDATES, then the emitBatch_
  // function will be invoked.
  public addToBatch = (message:bridge.SignallingMessage) : void => {
    // check input: there should be exactly one provider, with exactly one signal
    if (message.signals === undefined ||
        Object.keys(message.signals).length != 1 ||
        message.signals[Object.keys(message.signals)[0]].length != 1) {
      throw new Error('messages must have only one provider, with only one message');
    }

    // is this batchable?
    // no need to include the terminating message itself
    if (SignalBatcher.isTerminating_(message)) {
      var rawLength = 0;
      this.batch_.forEach((message:bridge.SignallingMessage) => {
        rawLength += JSON.stringify(message).length;
      });

      var flattened = SignalBatcher.flatten_(this.batch_);
      log.debug('%1: batch ready: %2', this.name_, flattened);

      this.batch_ = [];

      var flattenedJSON = JSON.stringify(flattened);
      var buffer = new Buffer(flattenedJSON);
      var compressedBuffer = zlib.gzipSync(buffer);
      var encoded = compressedBuffer.toString('base64');

      log.debug('%1: raw/batched/compressed/base64: %2/%3/%4/%5', this.name_,
          rawLength, flattenedJSON.length, compressedBuffer.length, encoded.length);

      this.emitBatch_(encoded);
    } else {
      log.debug('%1: adding signal to batch: %2', this.name_, message);
      this.batch_.push(message);
    }
  }
}
