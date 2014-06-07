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

    it("3 events then makePromise leaves 2 events and handles first",
        function(done) {
      queue.handle('A');
      queue.handle('B');
      queue.handle('C');
      queue.makePromise().then((s) => {
        expect(queue.getLength()).toEqual(2);
        expect(s).toEqual('A');
        done();
      });
    });

});  // describe("TaskManager", ... )

}  // module TaskManager
