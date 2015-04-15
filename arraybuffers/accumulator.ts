import ArrayBuffers = require('./arraybuffers');

// Small internal utility class for accumulating array buffers into a
// single buffer (until that buffer is big enough).
export class Accumulator {

  // The buffers being acculated are stored in a list.
  private buffers_ : ArrayBuffer[] = [];
  // minimum size of the accumulated buffer to call onBigEnoughBuffer on.
  private minSize_ :number;
  // The current size of all accumulated buffers.
  private currentSize_ :number = 0;

  constructor(minSize :number,
              public onBigEnoughBuffer :(bigBuffer:ArrayBuffer)=>void) {
    this.minSize_ = minSize;
  }

  // Set the minimal size. Returns true if it causes the buffer handler to be
  // called because the current size is bigger than the new minimal size.
  public setMinSize = (newMinSize :number) : number => {
    this.minSize_ = newMinSize;
    return this.maybeBigEnoughNow();
  }

  // Throw the buffers away and start again from zero.
  public clear = () : void => {
    this.buffers_ = [];
    this.currentSize_ = 0;
  }

  // Check if the buffer is big enough now and if so call the handler and
  // return the size of the handled accumulated buffer. Otherwise return zero.
  public maybeBigEnoughNow = () : number => {
    if(this.currentSize_ < this.minSize_) {
      return 0;
    }
    // Big enough now, to clear out old stuff and call the handler!
    // Note: for the wild use case of doing something that ends up adding
    // more stuff to this array buffer accumulator, we use temporary
    // variables to avoid potential infinite loop of maybeBigEnoughNow being
    // called.
    var buffers :ArrayBuffer[] = this.buffers_;
    var accumulatedSize :number = this.currentSize_;
    this.clear();
    this.onBigEnoughBuffer(
        arraybuffers.concat(buffers, accumulatedSize));
    return accumulatedSize;
  }

  // Add a buffer to the accumulated buffer(s). If this makes the accumulated
  // buffer bigger than the minimal size, then the handler is called and we
  // return the size of the buffer that was handled. Otherwise we return 0.
  public addBuffer = (a:ArrayBuffer) : number => {
    this.buffers_.push(a);
    this.currentSize_ += a.byteLength;
    return this.maybeBigEnoughNow();
  }
}
