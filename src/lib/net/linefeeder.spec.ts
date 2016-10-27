import * as arraybuffers from '../arraybuffers/arraybuffers';
import * as linefeeder from './linefeeder';
import * as queue from '../handler/queue';

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
