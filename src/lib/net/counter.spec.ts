/// <reference path='../../../third_party/typings/browser.d.ts' />

import counter = require('./counter');

describe('socket call counter', function() {
  // One wrapped call, then destroy.
  it('simple wrap', (done) => {
    var destroyCalled = false;
    var destructor = () => {
      destroyCalled = true;
    };

    var callCounter = new counter.Counter(destructor);
    var beforeSpy = spyOn(callCounter, 'before_').and.callThrough();
    var afterSpy = spyOn(callCounter, 'after_').and.callThrough();

    callCounter.wrap(() => {
      expect(beforeSpy).toHaveBeenCalled();
      expect(afterSpy).not.toHaveBeenCalled();

      return Promise.resolve(1);
    }).then((result:number) => {
      expect(result).toEqual(1);
      expect(afterSpy).toHaveBeenCalled();
      expect(destroyCalled).toBeFalsy();

      callCounter.discard();
    });

    callCounter.onceDestroyed().then(() => {
      expect(destroyCalled).toBeTruthy();
      done();
    });
  });
});
