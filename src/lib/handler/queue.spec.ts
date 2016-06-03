/// <reference path='../../../third_party/typings/browser.d.ts' />

import HandlerQueue = require('./queue');
import Aggregate = require('./aggregate');

import Queue = HandlerQueue.Queue;

// Simple testing class
class NumberSumAggregator implements Aggregate.Aggregator<number,string> {
  public sum :number;
  constructor(public min :number) { this.sum = 0; }
  public input = (n:number) => {
    this.sum += n;
  }
  public check = () => {
    if (this.sum < this.min) { return null; }
    var result = 'SUM_AT_OUTPUT:' + this.sum.toString();
    this.sum = 0;
    return result;
  }
}

describe('Handler Queue', function() {
  var queue :Queue<string, number>;
  var ncallbacks :number;
  function lenHandler(s:string) : number { return s.length; };
  function promiseLenHandler(s:string) : Promise<number> {
    return new Promise((F,R) => {
      setTimeout(F(s.length), 1);
    });
  }

  beforeEach(() => {
    queue = new Queue<string, number>();
    ncallbacks = 0;
  });

  it('New queue has no events (length = 0)', function() {
    expect(queue.getLength()).toBe(0);
  });

  it('3 events makes length = 3', function() {
    queue.handle('A');
    queue.handle('BB');
    queue.handle('CCC');
    expect(queue.getLength()).toBe(3);
  });

  it('3 events and then clearing makes length = 0', function() {
    queue.handle('A').catch(() => {});
    queue.handle('BB').catch(() => {});
    queue.handle('CCC').catch(() => {});
    queue.clear();
    expect(queue.getLength()).toBe(0);
  });

  it('setSyncNextHandler then handle 2 events: leaves second event queued',
      function(done) {
    var p1 = queue.setSyncNextHandler(lenHandler).then((n) => {
        expect(queue.isHandling()).toBe(false);
        expect(n).toBe(1);
        expect(queue.getLength()).toBe(1);
      });
    expect(queue.isHandling()).toBe(true);
    expect(queue.getLength()).toBe(0);
    var p2 = queue.handle('A').then((n) => {
        // This is the result of the handler. In this case, it is the length
        // of the handled string (i.e. 'A') which is 1.
        expect(n).toBe(1);
      });
    queue.handle('BB');

    // Complete only when every promise has completed.
    Promise.all<void>([p1,p2]).then((all) => {
      expect(queue.getLength()).toBe(1);
      done();
    });
  });

  it('setNextHandler then handle 2 events: leaves second event queued',
      function(done) {
    queue.setNextHandler(promiseLenHandler).then((s) => {
      expect(queue.isHandling()).toBe(false);
      expect(s).toBe(1);
      expect(queue.getLength()).toBe(1);
      done();
    });
    expect(queue.isHandling()).toBe(true);
    queue.handle('A');
    queue.handle('BB');
  });

  it('3 events then setSyncNextHandler leaves 2 events and handles first',
      function(done) {
    queue.handle('A');
    queue.handle('BB');
    queue.handle('CCC');
    queue.setSyncNextHandler(lenHandler).then((n:number) => {
      expect(queue.getLength()).toBe(2);
      expect(n).toBe(1);
      done();
    });
  });

  it('3 events then setSyncNextHandler to remove elements in order until empty',
      function(done) {
    queue.handle('A');
    queue.handle('BBB');
    queue.setSyncNextHandler(lenHandler)
      .then((n:number) => {
          expect(++ncallbacks).toBe(1);
          expect(queue.getLength()).toBe(1);
          expect(n).toBe(1);  // length of 'A'
        })
      .then(() => {
          expect(++ncallbacks).toBe(2);
          return queue.setSyncNextHandler(lenHandler);
        })
      .then((n:number) => {
          expect(++ncallbacks).toBe(3);
          expect(queue.getLength()).toBe(0);
          expect(n).toBe(3);  // length of 'BBB'
          // Notice that handle events canbe called mixed up with the handling.
          queue.handle('CCCCC');
          expect(queue.getLength()).toBe(1);
        })
      .then(() => {
          expect(++ncallbacks).toBe(4);
          return queue.setSyncNextHandler(lenHandler);
        })
      .then((n:number) => {
          expect(++ncallbacks).toBe(5);
          expect(queue.getLength()).toBe(0);
          expect(n).toBe(5); // length of 'CCCCC'
          done();
        })
  });

  it('successive setSyncHandler', function(done) {
    queue.handle('A');
    queue.setSyncNextHandler((s:string) => {
      expect(s).toEqual('A');
      return 0;
    }).then(() => {
      queue.setSyncNextHandler((s2:string) => {
        expect(s2).toEqual('B');
        expect(queue.getStats().handler_rejections).toEqual(0);
        done();
        return 0;
      });
      queue.handle('B');
    });
  });
});  // describe('Handler Queue', ... )

describe('Aggregated Handler Queue', function() {
  var queue :Queue<number, string>;
  var aggregateTo10Handler :Aggregate.AggregateHandler<number,string>;
  var ncallbacks :number;

  beforeEach(() => {
    queue = new Queue<number, string>();
    // A simple aggregator of numbers up to the specified |min|, at which
    // point the string of the sum of the numbers is returned.
    var MIN_AGGREGATION_VALUE = 10;
    aggregateTo10Handler = Aggregate.createAggregateHandler<number,string>(
        new NumberSumAggregator(MIN_AGGREGATION_VALUE));
    ncallbacks = 0;
  });

  it('Basic aggregateTo10Handler & first two handle results',
      function(done) {
    // Note that the return value for all the first three elements is the same
    // because we are using the aggregated handler. The aggregation concludes
    // only when we get over the specified min value (MIN_AGGREGATION_VALUE),
    // and then fulfills the promise for each value handled that is part of
    // that aggregation. We could write a different kind of aggregation
    // handler that does something different.
    var p1 = queue.handle(4);
    p1.then((s) => {
        expect(s).toBe('SUM_AT_OUTPUT:26');
      });
    var p2 = queue.handle(2);
    p2.then((s) => {
        expect(s).toBe('SUM_AT_OUTPUT:26');
      });

    // We set the handler at this point so test that the two earlier values
    // are indeed queued.
    queue.setHandler(aggregateTo10Handler.handle);
    expect(queue.isHandling()).toBe(true);
    var p3 = queue.handle(20);
    p3.then((s) => {
        expect(s).toBe('SUM_AT_OUTPUT:26');
      });

    // The return value for the next one is 21 because that is already over
    // the aggregate limit.
    var p4 = queue.handle(21);
    p4.then((s) => {
        expect(s).toBe('SUM_AT_OUTPUT:21');
      });

    // The promise return value for these two will not be called because they
    // will be being processed until enough data is put on the queue to
    // complete the next aggregation.
    var p5 = queue.handle(5);
    p5.then((s) => {
        expect('this should never happen').toBe(null);
      });
    var p6 = queue.handle(3);
    p6.then((s) => {
        expect('this should never happen either').toBe(null);
      });

    // Complete only when every promise has completed.
    Promise.all<string>([p1,p2,p3,p4]).then((all) => {
      expect(queue.isHandling()).toBe(true);
      done();
    });
  });

});  // describe('Handler Aggregated Queue', ... )
