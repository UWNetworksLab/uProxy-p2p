/// <reference path='../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='handler-queue.ts' />

module Handler {

  describe("Queue", function() {
    var queue :Queue<string, number>;
    function lenHandler(s:string) : number { return s.length; };
    function promiseLenHandler(s:string) : Promise<number> {
      return new Promise<number>((F,R) => {
        setTimeout(F(s.length), 1);
      });
    }

    beforeEach(() => {
      queue = new Queue<string, number>();
    });

    it("New queue has no events (length = 0)", function() {
      expect(queue.getLength()).toEqual(0);
    });

    it("3 events makes length = 3", function() {
      queue.handle('A');
      queue.handle('BB');
      queue.handle('CCC');
      expect(queue.getLength()).toEqual(3);
    });

    it("3 events and then clearing makes length = 0", function() {
      queue.handle('A');
      queue.handle('BB');
      queue.handle('CCC');
      queue.clear();
      expect(queue.getLength()).toEqual(0);
    });

    it("onceHandler then handle 2 events: leaves second event queued",
        function(done) {
      queue.onceHandler(lenHandler).then((s) => {
        expect(s).toEqual(1);
        expect(queue.getLength()).toEqual(1);
        done();
      });
      expect(queue.getLength()).toEqual(0);
      queue.handle('A');
      queue.handle('BB');
    });

    it("promiseLenHandler then handle 2 events: leaves second event queued",
        function(done) {
      queue.oncePromiseHandler(promiseLenHandler).then((s) => {
        expect(s).toEqual(1);
        expect(queue.getLength()).toEqual(1);
        done();
      });
      queue.handle('A');
      queue.handle('BB');
    });

    it("3 events then makePromise leaves 2 events and handles first",
        function(done) {
      queue.handle('A');
      queue.handle('BB');
      queue.handle('CCC');
      queue.onceHandler(lenHandler).then((n:number) => {
        expect(queue.getLength()).toEqual(2);
        expect(n).toEqual(1);
        done();
      });
    });

    it("3 events then makePromise to remove elements in order until empty",
        function(done) {
      queue.handle('A');
      queue.handle('BBB');
      queue.onceHandler(lenHandler)
        .then((n:number) => {
          expect(queue.getLength()).toEqual(1);
          expect(n).toEqual(1);  // length of 'A'
        })
        .then(() => { return queue.onceHandler(lenHandler); })
        .then((n:number) => {
          expect(queue.getLength()).toEqual(0);
          expect(n).toEqual(3);  // length of 'BBB'
          // Notice that handle events canbe called mixed up with the handling.
          queue.handle('CCCCC');
          expect(queue.getLength()).toEqual(1);
        })
        .then(() => { return queue.onceHandler(lenHandler); })
        .then((n:number) => {
          expect(queue.getLength()).toEqual(0);
          expect(n).toEqual(5); // length of 'CCCCC'
          done();
        })
    });

});  // describe("TaskManager", ... )

}  // module TaskManager
