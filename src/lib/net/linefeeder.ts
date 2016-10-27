import * as arraybuffers from '../arraybuffers/arraybuffers';
import * as queue from '../handler/queue';

// Transforms a raw network-like ArrayBuffer-based queue into
// a telnet-style string-based queue.
export class LineFeeder extends queue.Queue<string, void> {
  private static DELIMITER = arraybuffers.decodeByte(
      arraybuffers.stringToArrayBuffer('\n'));

  private leftover_ = new ArrayBuffer(0);

  constructor(private source_: queue.Queue<ArrayBuffer, void>) {
    super();
    source_.setSyncHandler((buffer: ArrayBuffer) => {
      this.leftover_ = arraybuffers.concat([this.leftover_, buffer]);
      let i = arraybuffers.indexOf(this.leftover_, LineFeeder.DELIMITER);
      while (i !== -1) {
        let parts = arraybuffers.split(this.leftover_, i);
        let line = arraybuffers.arrayBufferToString(parts[0]);
        this.leftover_ = parts[1].slice(1);
        i = arraybuffers.indexOf(this.leftover_, LineFeeder.DELIMITER);
        this.handle(line);
      }
    });
  }

  // Causes any pending line to be emitted. Intended to be called when the
  // underlying stream has terminated, possibly without any terminating
  // newline.
  public flush = () => {
    var s = arraybuffers.arrayBufferToString(this.leftover_);
    this.leftover_ = new ArrayBuffer(0);
    this.handle(s);
  }
}
