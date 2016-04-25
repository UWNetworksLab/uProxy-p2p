import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');
import random = require('../crypto/random');
import transformer = require('./transformer');

const log :logging.Log = new logging.Log('byte sequence shaper');

// Accepted in serialised form by configure().
export interface SequenceConfig {
  // Sequences that should be added to the outgoing packet stream.
  addSequences :SerializedSequenceModel[];

  // Sequences that should be removed from the incoming packet stream.
  removeSequences :SerializedSequenceModel[]
}

// Sequence models where the sequences have been encoded as strings.
// This is used by the SequenceConfig argument passed to configure().
export interface SerializedSequenceModel {
  // Index of the packet into the sequence.
  index :number;

  // Offset of the sequence in the packet.
  offset :number;

  // Byte sequence encoded as a string.
  sequence :string;

  // Target packet length.
  length :number
}

// Sequence models where the sequences have been decoded as ArrayBuffers.
// This is used internally by the ByteSequenceShaper.
export interface SequenceModel {
  // Index of the packet into the stream.
  index :number;

  // Offset of the sequence in the packet.
  offset :number;

  // Byte sequence.
  sequence :ArrayBuffer;

  // Target packet length.
  length :number
}

// Creates a sample (non-random) config, suitable for testing.
export var sampleConfig = () : SequenceConfig => {
  var buffer = arraybuffers.stringToArrayBuffer('OH HELLO');
  var hex = arraybuffers.arrayBufferToHexString(buffer);
  var sequence = {
    index: 0,
    offset: 0,
    sequence: hex,
    length: 256
  };

  return {
    addSequences: [sequence],
    removeSequences: [sequence]
  };
}

// An obfuscator that injects byte sequences.
export class ByteSequenceShaper implements transformer.Transformer {
  // Sequences that should be added to the outgoing packet stream.
  private addSequences_ :SequenceModel[];

  // Sequences that should be removed from the incoming packet stream.
  private removeSequences_ :SequenceModel[];

  // Index of the first packet to be injected into the stream.
  private firstIndex_ :number;

  // Index of the last packet to be injected into the stream.
  private lastIndex_ :number;

  // Current index into the output stream.
  // This starts at zero and is incremented every time a packet is output.
  // The outputIndex_ is compared to the SequenceModel index. When they are
  // equal, a byte sequence packet is injected into the output.
  private outputIndex_ :number = 0;

  public constructor() {
    this.configure(JSON.stringify(sampleConfig()));
  }

  // Configure the transformer with the byte sequences to inject and the byte
  // sequences to remove.
  public configure = (json:string) :void => {
    let config = JSON.parse(json);

    // Required parameters 'addSequences' and 'removeSequences'
    if ('addSequences' in config && 'removeSequences' in config) {
      // Deserialize the byte sequences from strings
      [this.addSequences_, this.removeSequences_] =
        ByteSequenceShaper.deserializeConfig(<SequenceConfig>config);

      // Make a note of the index of the first packet to inject
      this.firstIndex_ = this.addSequences_[0].index;

      // Make a note of the index of the last packet to inject
      this.lastIndex_ = this.addSequences_[this.addSequences_.length-1].index;
    } else {
      throw new Error('Byte sequence shaper requires addSequences and removeSequences parameters');
    }
  }

  public transform = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    let results :ArrayBuffer[] = [];

    // Check if the current index into the packet stream is within the range
    // where a packet injection could possibly occur.
    if (this.outputIndex_ <= this.lastIndex_) {
      // Injection has not finished, but may not have started yet.
      if (this.outputIndex_ >= this.firstIndex_) {
        // Injection has started and has not finished, so check to see if it is
        // time to inject a packet.

        // Inject fake packets before the real packet
        this.inject_(results);

        // Inject the real packet
        this.outputAndIncrement_(results, buffer);

        //Inject fake packets after the real packet
        this.inject_(results);
      } else {
        // Injection has not started yet. Keep track of the index.
        this.outputAndIncrement_(results, buffer);
      }

      return results;
    } else {
      // Injection has finished and will not occur again. Take the fast path and
      // just return the buffer.
      return [buffer];
    }
  }

  // Remove injected packets.
  public restore = (buffer :ArrayBuffer) :ArrayBuffer[] => {
    let match = this.findMatchingPacket_(buffer);
    if (match !== null) {
      return [];
    } else {
      return [buffer];
    }
  }

  // Decode the byte sequences from strings in the config information
  static deserializeConfig(config :SequenceConfig)
  :[SequenceModel[], SequenceModel[]] {
    let adds :SequenceModel[] = [];
    let rems :SequenceModel[] = [];

    for(let i = 0; i < config.addSequences.length; i++) {
      adds.push(ByteSequenceShaper.deserializeModel(config.addSequences[i]));
    }

    for(let i = 0; i < config.removeSequences.length; i++) {
      rems.push(ByteSequenceShaper.deserializeModel(config.removeSequences[i]));
    }

    return [adds, rems];
  }

  // Decode the byte sequence from a string in the sequence model
  static deserializeModel(model :SerializedSequenceModel) :SequenceModel {
    return {
      index:model.index,
      offset:model.offset,
      sequence:arraybuffers.hexStringToArrayBuffer(model.sequence),
      length:model.length
    };
  }

  // Inject packets
  private inject_ = (results :ArrayBuffer[]) : void => {
    let nextPacket = this.findNextPacket_(this.outputIndex_);
    while(nextPacket !== null) {
      this.outputAndIncrement_(results, this.makePacket_(nextPacket));
      nextPacket = this.findNextPacket_(this.outputIndex_);
    }
  }

  private outputAndIncrement_ = (results :ArrayBuffer[], result :ArrayBuffer) : void => {
    results.push(result);
    this.outputIndex_ = this.outputIndex_ + 1;
  }

  // For an index into the packet stream, see if there is a sequence to inject.
  private findNextPacket_ = (index :number) => {
    for(let i = 0; i < this.addSequences_.length; i++) {
      if (index === this.addSequences_[i].index) {
        return this.addSequences_[i];
      }
    }

    return null;
  }

  // For a byte sequence, see if there is a matching sequence to remove.
  private findMatchingPacket_ = (sequence :ArrayBuffer) => {
    for(let i = 0; i < this.removeSequences_.length; i++) {
      let model = this.removeSequences_[i];
      let target = model.sequence;
      let source = sequence.slice(model.offset, target.byteLength);
      if (arraybuffers.byteEquality(source, target)) {
        return this.removeSequences_.splice(i, 1);
      }
    }

    return null;
  }

  // With a sequence model, generate a packet to inject into the stream.
  private makePacket_ = (model :SequenceModel) :ArrayBuffer => {
    let parts :ArrayBuffer[] = [];

    // Add the bytes before the sequence.
    if (model.offset > 0) {
      let length = model.offset;
      let randomBytes = new Uint8Array(length);
      crypto.getRandomValues(randomBytes);
      parts.push(randomBytes.buffer);
    }

    // Add the sequence
    parts.push(model.sequence);

    // Add the bytes after the sequnece
    if (model.offset < model.length) {
      length = model.length - (model.offset + model.sequence.byteLength);
      let randomBytes = new Uint8Array(length);
      crypto.getRandomValues(randomBytes);
      parts.push(randomBytes.buffer);
    }

    return arraybuffers.concat(parts);
  }
}
