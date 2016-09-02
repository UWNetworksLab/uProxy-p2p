/// <reference path='../../../third_party/browserify-zlib/browserify-zlib.d.ts' />
/// <reference path='../../../third_party/typings/index.d.ts' />

import bridge = require('./bridge');
import churn_types = require('../churn/churn.types');
import logging = require('../logging/logging');
import signals = require('../webrtc/signals');
import zlib = require('browserify-zlib');

var log :logging.Log = new logging.Log('signal batcher');

// Decodes a batch of signalling messages encoded by SignalBatcher.
// Handles both compressed and uncompressed messages.
export var decode = (encoded:string) : Object[] => {
  var decoded = new Buffer(encoded, 'base64');
  var uncompressedBuffer :Buffer;
  try {
    uncompressedBuffer = zlib.gunzipSync(decoded);
  } catch (e) {
    log.debug('gzip failed, assuming uncompressed messages');
    uncompressedBuffer = decoded;
  }
  var json = uncompressedBuffer.toString();
  return JSON.parse(json);
};

// Queues objects, invoking a callback with base64-encoded string
// representing a "batch" of the queued objects, optionally compressed
// with gzip. Batches are determined by the client via the
// isTerminating_ function. Note that the terminating message itself
// is not included in batches.
// Intended for use in copy/paste scenarios where the size and number
// of messages transmitted are crucial.
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
      private compress_:boolean = false,
      private name_ :string = 'unnamed-signal-batcher-' + SignalBatcher.id_) {
    SignalBatcher.id_++;
  }

  // Adds a message to the current batch. If the message looks like a
  // "terminating" message, i.e. NO_MORE_CANDIDATES, then the emitBatch_
  // function will be invoked.
  public addToBatch = (message:T) : void => {
    if (this.isTerminating_(message)) {
      let batchAsJson = JSON.stringify(this.batch_);
      let buffer = new Buffer(batchAsJson);
      let encoded :string;
      if (this.compress_) {
        let compressedBuffer = zlib.gzipSync(buffer);
        encoded = compressedBuffer.toString('base64');
        log.info('%1: batch ready (raw/compressed/base64: %2/%3/%4)', this.name_,
            batchAsJson.length, compressedBuffer.length, encoded.length);
      } else {
        encoded = buffer.toString('base64');
        log.info('%1: batch ready (raw/base64: %2/%3)', this.name_,
            batchAsJson.length, encoded.length);
      }

      this.emitBatch_(encoded);

      // Prepare for the next batch if it happens, e.g. due to renegotiation.
      this.batch_ = [];
    } else {
      this.batch_.push(message);
    }
  }
}
