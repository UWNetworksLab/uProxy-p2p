/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import queue = require('../handler/queue');

// Transforms a raw network-like ArrayBuffer-based queue into
// a telnet-style string-based queue.
export class LineFeeder extends queue.Queue<string, void> {
  private static DELIMITER = arraybuffers.decodeByte(
      arraybuffers.stringToArrayBuffer('\n'));

  constructor(source: queue.Queue<ArrayBuffer, void>) {
    super();
    let leftover = new ArrayBuffer(0);
    source.setSyncHandler((buffer: ArrayBuffer) => {
      leftover = arraybuffers.concat([leftover, buffer]);
      let i = arraybuffers.indexOf(leftover, LineFeeder.DELIMITER);
      while (i !== -1) {
        let parts = arraybuffers.split(leftover, i);
        let line = arraybuffers.arrayBufferToString(parts[0]);
        leftover = parts[1].slice(1);
        i = arraybuffers.indexOf(leftover, LineFeeder.DELIMITER);
        this.handle(line);
      }
    });
  }
}
