import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');

var log :logging.Log = new logging.Log('fancy-transformers');

// Here is some background reading on arithmetic coding and range coding.
// http://www.arturocampos.com/ac_arithmetic.html
// http://www.arturocampos.com/ac_range.html
// http://www.compressconsult.com/rangecoder/
// http://sachingarg.com/compression/entropy_coding/range_coder.pdf
// http://ezcodesample.com/reanatomy.html
// http://www.cc.gatech.edu/~jarek/courses/7491/Arithmetic2.pdf
// http://www.drdobbs.com/cpp/data-compression-with-arithmetic-encodin/240169251?pgno=2

// Summarized from "A Fast Renormalisation Method for Arithmetic Coding" by
// Michael Schindler:
//
// At any point during arithmetic coding the output consists of four parts:
// 1. The part already written into the output buffer and does not change.
// 2. One digit that may be changed by at most one carry when adding to the
//    lower end of the interval. There will never be two carries. since the
//    range when fixing that digit was <= 1 unit. Two carries would require
//    range > 1 unit.
// 3. There is a (possibly empty) block of digits that pass on a carry. (255 for
//    bytes) that are represented by a counter counting their number.
// 4. The last part is represented by the low end range variable of the encoder.

// Returns the sum of a list of numbers
function sum(items :number[]) :number {
  return items.reduce((a :number, b :number ) => {
    return a + b;
  }, 0);
}

// Takes an input list of integer and returns a list of integers where all of
// the input integer have been divided by a constant.
function scale(items :number[], divisor :number) :number[] {
  return items.map((item :number) => {
    let scaled = Math.floor(item / divisor);
    if (scaled === 0) {
       return 1;
    } else {
      return scaled;
    }
  });
}

// Takes a list of numbers where the inputs should all be integers from 0 to
// 255 and converts them to bytes in an ArrayBuffer.
function saveProbs(items :number[]) :ArrayBuffer {
  var bytes = new Uint8Array(items.length);
  for(var index = 0; index < items.length; index++) {
    if (items[index] >= 0 && items[index] <= 255) {
      bytes[index] = items[index];
    } else {
      throw new Error("Probabilities must be between 0 and 255 inclusive.");
    }
  }
  return bytes.buffer;
}

// Models a symbol as an interval in the arithmetic coding space
export interface Interval {
  // The byte that corresponds to this interval in the coding
  symbol :number;

  // The lower range of the interval
  low :number;

  // The length of this interval
  length :number;

  // The upper range of this interval
  // This should always be lower+length
  // This is precomputed and stored separately in order to increase the clarity
  // of the implementation of the coding algorithm.
  high :number
}

// Creates a new interval
// This maintains the constraint that high = low + length.
function makeInterval(symbol :number, low :number, length :number) {
  return {
    symbol: symbol,
    low: low,
    length: length,
    high: low + length
  }
}

// The precision of the arithmetic coder
const CODE_BITS :number = 32;

// The maximum possible signed value given the precision of the coder.
const TOP_VALUE :number = Math.pow(2, CODE_BITS - 1);

// The maximum possible unsigned value given the precision of the coder.
const MAX_INT :number = Math.pow(2, CODE_BITS) - 1;

// The number of bits to shift over during renormalization.
const SHIFT_BITS :number = CODE_BITS - 9;

// Tne number of bits left over during renormalization.
const EXTRA_BITS = (CODE_BITS - 2) % 8 + 1;

// The lowest possible value.
// Anything lower than this will be shifted up during renormalization.
const BOTTOM_VALUE = TOP_VALUE >>> 8;

// The state and initialiation code for arithmetic coding.
// This class is never instantiated directly.
// The subclasses Encoder and Decoder are used instead.
export class Coder {
  // The probability distribution of the input.
  // This will be a list of 256 entries, each consisting of an integer from
  // 0 to 255.
  protected probabilities_ :number[];

  // The low end of the encoded range. Starts at 0.
  protected low_ :number = 0x00000000;

  // The high end of the encoded range. Starts at the maximum 32-bit value.
  protected high_ :number = 0xFFFFFFFF;

  // The extra bits that need to be stored for later if underflow occurs.
  protected underflow_ :number = 0;

  // The current byte that's being constructed for eventual output.
  protected working_ :number = 0;

  // A coding table derived from the probability distribution.
  protected intervals_ :{[index :number] :Interval} = {};

  // The total of the lengths of all intervals in the coding table.
  // This determines the maximum amount that the range can change by encoding
  // one symbol.
  protected total_ :number;

  // The input buffer. This is a list of bytes represented as numbers.
  protected input_ :number[] = [];

  // The output buffer. This is a list of bytes represented as numbers.
  protected output_ :number[] = [];

  // The Coder constructor normalizes the symbol probabilities and build the
  // coding table.
  public constructor(probs :number[]) {
    // Scale the symbol probabilities to fit constraints.
    this.probabilities_ = Coder.adjustProbs_(probs);

    // Build the symbol table.
    var low = 0;
    for(var index = 0; index < probs.length; index++) {
      this.intervals_[index] = makeInterval(index, low, probs[index]);
      low = low + probs[index];
    }

    // Calculate the sum of the lengths of all intervals.
    this.total_ = sum(this.probabilities_);
  }

  // Scale the symbol probabilities to fit the following constraints:
  // - No probability can be higher than 255.
  // - The sum of all probabilities must be less than 2^14.
  static adjustProbs_ = (probs :number[]) :number[] => {
    // The maximum value for any single probability
    const MAX_PROB :number = 255;

    // The amount to scale probabilities if they are greater than the maximum.
    const SCALER :number = 256;

    // The maximum value for the sum of all probabilities. 2^14
    const MAX_SUM :number = 16384;

    // If any single probability is too high, rescale.
    var highestProb = Math.max(...probs);
    if (highestProb > MAX_PROB) {
      var divisor = highestProb / SCALER;
      probs = scale(probs, divisor);
    }

    // If the sum of probabilities is too high, rescale.
    while(sum(probs) >= MAX_SUM) {
      probs = scale(probs, 2);
    }

    return probs;
  }
}

// Encodes a sequence of bytes using a probability distribution with the goal of
// yielding a higher entropy sequence of bytes.
export class Encoder extends Coder {
  // Encode a sequence of bytes.
  public encode = (input :ArrayBuffer) :ArrayBuffer => {
    // Initialize state.
    // The Coder superclass initializes state common to Encoder and Decoder.
    // Encoder and Decoder do some additional initialization that must be
    // reset when encoding each byte sequence.
    this.init_();

    // Encode all of the symbols in the input ArrayBuffer
    // The primary effect is to fill up the output buffer with output bytes.
    // Internal state variables also change after encoding each symbol.
    var bytes = new Uint8Array(input);
    for(var index = 0; index < bytes.length; index++) {
      this.encodeSymbol_(bytes[index]);
    }

    // Flush any remaining state in the internal state variables into
    // the output buffer.
    this.flush_();

    // Copy the output buffer into an ArrayBuffer that can be returned.
    var output = new Uint8Array(this.output_.length);
    for(index = 0; index < this.output_.length; index++) {
      output[index] = this.output_[index];
    }

    // Return the ArrayBuffer copy of the internal output buffer.
    return output.buffer;
  }

  // Initialize state.
  // The Coder superclass initializes state common to Encoer and Decoder.
  // Encoder and Decoder do some additional initialization that must be
  // reset when encoding each byte sequence.
  private init_ = () :void => {
    this.low_ = 0;
    this.high_ = TOP_VALUE;
    this.working_ = 0xCA;
    this.underflow_ = 0;
    this.input_ = [];
    this.output_ = [];
  }

  // Encode a symbol. The symbol is a byte represented as a number.
  // The effect of this is to change internal state variables.
  // As a consequence, bytes may of may not be written to the output buffer.
  // When all symbols have been encoded, flush() must be called to recover any
  // remaining state.
  private encodeSymbol_ = (symbol :number) => {
    // Look up the corresponding interval for the symbol in the coding table.
    // This is what we actually use for encoding.
    var interval = this.intervals_[symbol];

    // Renormalize. This is the complicated but less interesting part of coding.
    // This is also where bytes are actually written to the output buffer.
    this.renormalize_();

    // Now do the interesting part of arithmetic coding.
    // Every sequence of symbols is mapped to a positive integer.
    // As we encode each symbol we are calculating the digits of this integer
    // using the interval information for the symbol.
    // The result of encoding a symbol is a new range, as represented by are new
    // values for low_ and high_.

    // The new symbol subdivides the existing range.
    // Take the existing range and subdivide it by the total length of the
    // intervals in the coding table.
    var newRange = this.high_ / this.total_;

    // Find the place in the new subdivide range where the new symbol's interval
    // begins.
    var temp = newRange * interval.low;

    // The case where the symbol being encoded has the highest range is a
    // special case.
    if (interval.high >= this.total_) {
      // Special case where the symbol being encoded has the highest range
      // Adjust the high part of the range
      this.high_ = this.high_ - temp;
    } else {
      // General case
      // Adjust the high part of the range
      this.high_ = newRange * interval.length;
    }

    // Adjust the low part of the range
    this.low_ = this.low_ + temp;
  }

  // Summarized from "A Fast Renormalisation Method for Arithmetic Coding" by
  // Michael Schindler:
  //
  // When doing encoding renormalisation the following can happen:
  // A No renormalisation is needed since the range is in the desired interval.
  // B The low end plus the range (this is the upper end of the interval) will
  //   not produce any carry. In this case the second and third part can be
  //   output as they will never change. The digit produced will become part two
  //   and part three will be empty.
  // C The low end has already produced a carry. Here the (changed) second and
  //   third part can be output. There will not be another carry. Set the second
  //   and third part as before.
  // D The digit produced will pass on a possible future carry, so it is added
  //   to the third block.
  private renormalize_ = () :void => {
    // If renormalization is needed, we are in case B, C, or D.
    // Otherwise, we are in case A.
    while(this.high_ <= BOTTOM_VALUE) {
      if (this.low_ < (0xFF << SHIFT_BITS)) {
        // B The low end plus the range (this is the upper end of the interval) will
        //   not produce any carry. In this case the second and third part can be
        //   output as they will never change. The digit produced will become part two
        //   and part three will be empty.
        this.write_(this.working_);
        for(; this.underflow_ !== 0; this.underflow_ = this.underflow_ - 1) {
          this.write_(0xFF);
        }
        this.working_ = (this.low_ >>> SHIFT_BITS) & 0xFF;
      } else if ((this.low_ & TOP_VALUE) !== 0) {
          // C The low end has already produced a carry. Here the (changed) second and
          //   third part can be output. There will not be another carry. Set the second
          //   and third part as before.
          this.write_(this.working_ + 1);
          for(; this.underflow_ !== 0; this.underflow_ = this.underflow_ - 1) {
            this.write_(0x00);
          }

          this.working_ = (this.low_ >>> SHIFT_BITS) & 0xFF;
      } else {
          // D The digit produced will pass on a possible future carry, so it is added
          //   to the third block.
          this.underflow_ = this.underflow_ + 1;
      }

      // This is the goal of renormalization, to move the whole range over 8
      // bits in order to make room for more computation.
      this.high_ = (this.high_ << 8) >>> 0;
      this.low_ = ((this.low_ << 8) & (TOP_VALUE - 1)) >>> 0;
    }

    // A No renormalisation is needed since the range is in the desired interval.
  }

  private flush_ = () :void => {
    // Output the internal state variables.
    this.renormalize_();
    var temp = this.low_ >>> SHIFT_BITS;
    if (temp > 0xFF) {
      this.write_(this.working_ + 1);
      for(; this.underflow_ !== 0; this.underflow_ = this.underflow_ - 1) {
        this.write_(0x00);
      }
    } else {
      this.write_(this.working_);
      for(; this.underflow_ !== 0; this.underflow_ = this.underflow_ - 1) {
        this.write_(0xFF);
      }
    }

    // Output the remaining internal state.
    this.write_(temp & 0xFF);
    this.write_((this.low_ >>> (23 - 8)) & 0xFF);

    // Output the length
    this.write_((this.output_.length >>> 8) & 0xFF);
    this.write_((this.output_.length) & 0xFF);
  }

  private write_ = (byte:number) :void => {
    this.output_.push(byte);
  }
}

// Decodes a sequence of bytes using a probability distribution with the goal of
// yielding a lower entropy sequence of bytes.
export class Decoder extends Coder {
  // Decode a sequence of bytes
  public decode = (input :ArrayBuffer) :ArrayBuffer => {
    // Create an empty input buffer.
    this.input_ = [];

    // Fetch the size of the target output.
    // This is encoded as two bytes at the end of the encoded byte sequence.
    var sizeBytes = input.slice(-2);
    // Decode the two-byte size into a number.
    var size = arraybuffers.decodeShort(sizeBytes) - 4;

    // Copy the bytes from the given ArrayBuffer into the internal input buffer.
    var bytes = new Uint8Array(input);
    for(var index = 0; index < bytes.length; index++) {
      this.input_.push(bytes[index]);
    }

    // Initialize state.
    // The Coder superclass initializes state common to Encoder and Decoder.
    // Encoder and Decoder do some additional initialization that must be
    // reset when encoding each byte sequence.
    this.init_();
    // Decode all of the symbols in the input buffer
    // The primary effect is to fill up the output buffer with output bytes.
    // Internal state variables also change after decoding each symbol.
    this.decodeSymbols_();
    // Flush any remaining state in the internal state variables into
    // the output buffer.
    this.flush_();

    // Copy the output buffer into an ArrayBuffer that can be returned.
    var output=new Uint8Array(this.output_.length);
    for(index = 0; index < this.output_.length; index++) {
      output[index] = this.output_[index];
    }

    return output.buffer;
  }

  // Initialize state variables for decoding.
  private init_ = () :void => {
    // Discard first byte because the encoder is weird.
    var discard = this.input_.shift();
    this.working_ = this.input_.shift();
    this.low_ = this.working_ >>> (8 - EXTRA_BITS);
    this.high_ = 1 << EXTRA_BITS;
    this.underflow_ = 0;
    this.output_ = [];
  }

  // Decode symbols from the input buffer until it is empty.
  private decodeSymbols_ = () :void => {
    while(this.input_.length > 0) {
      this.decodeSymbol_();
    }
  }

  // Run the decoding algorithm. This uses internal state variables and
  // may or may not consume bytes from the input buffer.
  // The primary result of running this is changing internal state variables
  // and one byte will always be written to the output buffer.
  // After decoding symbols, flush_ must be called to get the remaining state
  // out of the internal state variables.
  private decodeSymbol_ = () :void => {
    // Renormalize. This is the complicated but less interesting part of coding.
    // This is also where bytes are actually read from the input buffer.
    this.renormalize_();

    //
    this.underflow_ = this.high_ >>> 8;
    var temp = (this.low_ / this.underflow_) >>> 0;

    // Calculate the byte to output.
    // There is a special case for 255.
    var result :number = null;
    if (temp >>> 8 !== 0) {
      // Special case.
      // Output 255.
      result = 255;
    } else {
      // General case.
      // Output the byte that has been calculated.
      result = temp;
    }

    // Output the decoded byte into the output buffer.
    this.output_.push(result);

    // Update the internal state variables base on the byte that was decoded.
    this.update_(result);
  }

  // Renormalizing is the tricky but boring part of coding.
  // The purpose of renormalizing is to allow the computation of an arbitrary
  // precision fraction using only 32 bits of space.
  // In the range coding variant of arithmetic coding implemented here,
  // renormalization happens at bytes instead of bits. This means that it
  // happens less frequently and so is faster to compute.
  private renormalize_ = () :void => {
    // Renormalization clears bits out of the working area to make room for
    // more bits for computation. Continue until the working area is clear.
    while(this.high_ <= BOTTOM_VALUE) {
      // More the high bits over to make room.
      // This might have caused the sign bit to be set, so coerce from a float
      // to a 32-bit unsigned int.
      this.high_ = (this.high_ << 8) >>> 0;

      // Shift the low end of the range over to make room.
      // Shift the working byte and move it into the low end of the range.
      this.low_ = (this.low_ << 8) | ((this.working_ << EXTRA_BITS) & 0xFF);

      // Obtain new bits to decode if there are any in the input buffer.
      // There is a special case when the input buffer is empty.
      if (this.input_.length == 0) {
        // Special case. The input buffer is empty.
        // This will only be called while flushing the internal state variables.
        this.working_ = 0;
      } else {
        // General case. There input buffer has bits that have not been decoded.
        // Put them in the working byte.
        this.working_ = this.input_.shift();
      }

      // Load the bits from the new working byte into the low end of the range.
      // Be careful not to overwrite the bits we stored in there from the old
      // working byte.
      this.low_ = (this.low_ | (this.working_ >>> (8-EXTRA_BITS)));
      // Coerce the low end of the range from a float to a 32-bit unsigned int.
      this.low_ = this.low_ >>> 0;
    }
  }

  // Update internal state variables based on the symbol that was last decoded.
  private update_ = (symbol :number) :void => {
    // Look up the corresponding interval for the symbol in the coding table.
    // This is what we actually use for encoding.
    var interval = this.intervals_[symbol];

    // Recover the bits stored from the underflow
    // This will be 0 if there are no underflow bits.
    var temp = this.underflow_ * interval.low;

    // Adjust the low value to account for underflow.
    // There is no adjustment if there are no underflow bits.
    this.low_ = this.low_ - temp;

    // The case where the symbol being encoded has the highest range is a
    // special case.
    if (interval.high >= this.total_) {
      // Special case where the symbol being encoded has the highest range
      // Adjust the high part of the range
      this.high_ = this.high_ - temp;
    } else {
      // General case
      // Adjust the high part of the range
      this.high_ = this.underflow_*interval.length;
    }
  }

  // Get the remaining information from the internal state variables and
  // write it to the output buffer.
  // This should be called after the input buffer is empty.
  private flush_ = () :void => {
    // Attempt to decode a symbol even though the input buffer is empty.
    // This should get the remaining state out of working_.
    this.decodeSymbol_();
    // Renormalize. This should get the remaining state out of the rest of the
    // internal state variables.
    this.renormalize_();
  }
}
