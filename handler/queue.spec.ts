/// <reference path='../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='aggregate.ts' />
/// <reference path='queue.ts' />

module Handler {

  // Simple testing class
  class NumberSumAggregator implements Aggregator<number,string> {
    public sum :number;
    constructor(public min :number) { this.sum = 0; }
    public input = (n:number) => {
      this.sum += n;
    }
    public check = () => {
      if (this.sum < this.min) { return null; }
      var result = this.sum.toString();
      this.sum = 0;
      return result;
    }
  }

  describe('Handler Queue', function() {
    var queue :Queue<string, number>;
    var ncallbacks :number;
    function lenHandler(s:string) : number { return s.length; };
    function promiseLenHandler(s:string) : Promise<number> {
      return new Promise<number>((F,R) => {
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
      queue.handle('A');
      queue.handle('BB');
      queue.handle('CCC');
      queue.clear();
      expect(queue.getLength()).toBe(0);
    });

    it('onceHandler then handle 2 events: leaves second event queued',
        function(done) {
      queue.onceHandler(lenHandler).then((n) => {
        expect(n).toBe(1);
        expect(queue.getLength()).toBe(1);
        expect(++ncallbacks).toBe(1);
      });
      expect(queue.getLength()).toBe(0);
      queue.handle('A').then((n) => {
          expect(n).toBe(1);  // length of 'A' is 2
          expect(++ncallbacks).toBe(2);
          done();
        });
      queue.handle('BB');
      expect(queue.getLength()).toBe(1);
    });

    it('promiseLenHandler then handle 2 events: leaves second event queued',
        function(done) {
      queue.oncePromiseHandler(promiseLenHandler).then((s) => {
        expect(s).toBe(1);
        expect(queue.getLength()).toBe(1);
        done();
      });
      queue.handle('A');
      queue.handle('BB');
    });

    it('3 events then makePromise leaves 2 events and handles first',
        function(done) {
      queue.handle('A');
      queue.handle('BB');
      queue.handle('CCC');
      queue.onceHandler(lenHandler).then((n:number) => {
        expect(queue.getLength()).toBe(2);
        expect(n).toBe(1);
        done();
      });
    });

    it('3 events then makePromise to remove elements in order until empty',
        function(done) {
      queue.handle('A');
      queue.handle('BBB');
      queue.onceHandler(lenHandler)
        .then((n:number) => {
            expect(++ncallbacks).toBe(1);
            expect(queue.getLength()).toBe(1);
            expect(n).toBe(1);  // length of 'A'
          })
        .then(() => {
            expect(++ncallbacks).toBe(2);
            return queue.onceHandler(lenHandler);
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
            return queue.onceHandler(lenHandler);
          })
        .then((n:number) => {
            expect(++ncallbacks).toBe(5);
            expect(queue.getLength()).toBe(0);
            expect(n).toBe(5); // length of 'CCCCC'
            done();
          })
    });
  });  // describe('Handler Queue', ... )

  describe('Aggregated Handler Queue', function() {
    var queue :Queue<number, string>;
    var aggregateTo10Handler :AggregateUntil<number,string>;
    var ncallbacks :number;

    beforeEach(() => {
      queue = new Queue<number, string>();
      // A simple aggregator of numbers up to the specified |min|, at which
      // point the string of the sum of the numbers is returned.

      aggregateTo10Handler = new AggregateUntil<number,string>(
          new NumberSumAggregator(10));

      ncallbacks = 0;
    });

    it('Basic aggregateTo10Handler & first two handle results',
        function(done) {
      var p1 = queue.handle(4);
      p1.then((s) => {
          expect(s).toBe('26');
        });
      var p2 = queue.handle(2);
      p2.then((s) => {
          expect(s).toBe('26');
        });
      queue.setPromiseHandler(aggregateTo10Handler.handle);
      var p3 = queue.handle(20);
      p3.then((s) => {
          expect(s).toBe('26');
        });
      var p4 = queue.handle(21);
      p4.then((s) => {
          expect(s).toBe('21');
        });
      var p5 = queue.handle(5);
      var p6 = queue.handle(3);

      // Complete only when every promise has completed.
      Promise.all<string>([p1,p2,p3,p4]).then((all) => { done(); });
    });

  });  // describe('Handler Aggregated Queue', ... )

}  // module TaskManager
