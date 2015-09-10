/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/browserify-zlib/browserify-zlib.d.ts' />

import bridge = require('./bridge');
import churn_types = require('../churn/churn.types');
import logging = require('../logging/logging');
import signals = require('../webrtc/signals');
import zlib = require('browserify-zlib');

var log :logging.Log = new logging.Log('signal batcher');

// Uncompresses a batch of signalling messages encoded by SignalBatcher.
export var decode = (encoded:string) : Object[] => {
  var decoded = new Buffer(encoded, 'base64');
  var uncompressedBuffer = zlib.gunzipSync(decoded);
  var json = uncompressedBuffer.toString();
  return JSON.parse(json);
};

// Queues objects, invoking a callback with a compressed, base64-encoded
// string representing a "batch" of the queued objects. Batches are
// determined by the client via the isTerminating_ function.
// Intended for use in copy/paste scenarios where the size and number
// of messages transmitted are crucial.
// gzip is used for compression.
export class SignalBatcher<T> {
  // Number of instances created, for logging purposes.
  private static id_ = 0;

  // Messages received since creation or last NO_MORE_CANDIDATES message.
  private batch_ :T[] = []

  // emitBatch_ will be invoked when a batch is complete with a string
  // which can be sent over the wire and decoded with decode().
  // isTerminating_ is invoked for each message and, if it returns true,
  // causes a new batch to be emitted.
  constructor(
      private emitBatch_ :(message:string) => void,
      private isTerminating_ :(message:T) => boolean,
      private name_ :string = 'unnamed-signal-batcher-' + SignalBatcher.id_) {
    SignalBatcher.id_++;
  }

  // Adds a message to the current batch. If the message looks like a
  // "terminating" message, i.e. NO_MORE_CANDIDATES, then the emitBatch_
  // function will be invoked.
  public addToBatch = (message:T) : void => {
    if (this.isTerminating_(message)) {
      var batchAsJson = JSON.stringify(this.batch_);
      var buffer = new Buffer(batchAsJson);
      var compressedBuffer = zlib.gzipSync(buffer);
      var encoded = compressedBuffer.toString('base64');

      log.info('%1: batch ready (raw/compressed/base64: %2/%3/%4)', this.name_,
          batchAsJson.length, compressedBuffer.length, encoded.length);

      this.emitBatch_(encoded);

      // Prepare for the next batch if it happens, e.g. due to renegotiation.
      this.batch_ = [];
    } else {
      this.batch_.push(message);
    }
  }
}
