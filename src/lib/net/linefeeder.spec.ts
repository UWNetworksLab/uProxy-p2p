/// <reference path='../../../third_party/typings/browser.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import linefeeder = require('./linefeeder');
import queue = require('../handler/queue');

describe('LineFeeder', function() {
  let bufferQueue: queue.Queue<ArrayBuffer, void>;
  let lines: linefeeder.LineFeeder;

  beforeEach(() => {
    bufferQueue = new queue.Queue<ArrayBuffer, void>();
    lines = new linefeeder.LineFeeder(bufferQueue);
  });

  it('one and done', (done) => {
    const s = 'hello world';
    bufferQueue.handle(arraybuffers.stringToArrayBuffer(s));
    lines.flush();

    lines.setSyncNextHandler((result: string) => {
      expect(result).toEqual(s);
      done();
    });
  });

  it('lines of multiple buffers', (done) => {
    const s = 'hello world';
    bufferQueue.handle(arraybuffers.stringToArrayBuffer('hello '));
    bufferQueue.handle(arraybuffers.stringToArrayBuffer('world\n'));
    lines.flush();

    lines.setSyncNextHandler((result: string) => {
      expect(result).toEqual(s);
      done();
    });
  });

  it('buffers of multiple lines', (done) => {
    bufferQueue.handle(arraybuffers.stringToArrayBuffer('a\nb\n'));
    lines.flush();

    lines.setSyncNextHandler((result: string) => {
      expect(result).toEqual('a');
      lines.setSyncNextHandler((result: string) => {
        expect(result).toEqual('b');
        done();
      });
    });
  });
});
