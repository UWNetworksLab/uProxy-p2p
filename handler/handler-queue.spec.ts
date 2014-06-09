/// <reference path='../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='handler-queue.ts' />

module Handler {

  describe("Queue", function() {
    var queue :Queue<string>;

    beforeEach(() => {
      queue = new Queue<string>();
    });

    it("New queue has no events (length = 0)", function() {
      expect(queue.getLength()).toEqual(0);
    });

    it("3 events makes length = 3", function() {
      queue.handle('A');
      queue.handle('B');
      queue.handle('C');
      expect(queue.getLength()).toEqual(3);
    });

    it("3 events and then clearing makes length = 0", function() {
      queue.handle('A');
      queue.handle('B');
      queue.handle('C');
      queue.clear();
      expect(queue.getLength()).toEqual(0);
    });


    it("makePromise then handle 2 events: leaves second event queued",
        function(done) {
      queue.onceHandler().then((s) => {
        expect(s).toEqual('A');
        expect(queue.getLength()).toEqual(1);
        done();
      });
      queue.handle('A');
      queue.handle('B');
    });

    it("3 events then makePromise leaves 2 events and handles first",
        function(done) {
      queue.handle('A');
      queue.handle('B');
      queue.handle('C');
      queue.onceHandler().then((s) => {
        expect(queue.getLength()).toEqual(2);
        expect(s).toEqual('A');
        done();
      });
    });

    it("3 events then makePromise to remove elements in order until empty",
        function(done) {
      queue.handle('A');
      queue.handle('B');
      queue.handle('C');
      queue.onceHandler()
        .then((s) => {
          expect(queue.getLength()).toEqual(2);
          expect(s).toEqual('A');
        })
        .then(queue.onceHandler)
        .then((s) => {
          expect(queue.getLength()).toEqual(1);
          expect(s).toEqual('B');
        })
        .then(queue.onceHandler)
        .then((s) => {
          expect(queue.getLength()).toEqual(0);
          expect(s).toEqual('C');
          done();
        })
    });

});  // describe("TaskManager", ... )

}  // module TaskManager
