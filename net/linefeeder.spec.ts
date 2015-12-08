/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import linefeeder = require('./linefeeder');
import queue = require('../handler/queue');

describe('LineFeeder', function() {
  var bufferQueue: queue.Queue<ArrayBuffer, void>;
  var lines: linefeeder.LineFeeder;

  beforeEach(() => {
    bufferQueue = new queue.Queue<ArrayBuffer, void>();
    lines = new linefeeder.LineFeeder(bufferQueue);
  });

  it('one and done', (done) => {
    var s = 'hello world';
    bufferQueue.handle(arraybuffers.stringToArrayBuffer(s + '\n'));

    lines.setSyncNextHandler((result: string) => {
      expect(result).toEqual(s);
      done();
    });
  });

  it('dangling lines', (done) => {
    var s = 'hello world';
    bufferQueue.handle(arraybuffers.stringToArrayBuffer('hello '));
    bufferQueue.handle(arraybuffers.stringToArrayBuffer('world\n'));

    lines.setSyncNextHandler((result: string) => {
      expect(result).toEqual(s);
      done();
    });
  });

  it('multiple lines in one buffer', (done) => {
    bufferQueue.handle(arraybuffers.stringToArrayBuffer('a\nb\n'));

    lines.setSyncNextHandler((result: string) => {
      expect(result).toEqual('a');
      lines.setSyncNextHandler((result: string) => {
        expect(result).toEqual('b');
        done();
      });
    });
  });
});
