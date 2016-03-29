/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import promises = require('./promises');

describe('retry', () => {
  const MAX_ATTEMPTS = 5;
  const RETURN_VALUE = 'hello';
  const REJECT_MESSAGE = 'goodbye';

  it('only calls successful function once', (done) => {
    const f = jasmine.createSpy('spy');
    f.and.returnValue(Promise.resolve(RETURN_VALUE));
    promises.retry(f, MAX_ATTEMPTS).then((result: string) => {
      expect(f.calls.count()).toEqual(1);
      expect(result).toEqual(RETURN_VALUE);
      done();
    });
  });

  it('calls multiple times until success', (done) => {
    const NUM_CALLS_BEFORE_SUCCESS = 3;
    let callCount = 0;
    const f = jasmine.createSpy('spy');
    f.and.callFake(() => {
      callCount++;
      if (callCount === NUM_CALLS_BEFORE_SUCCESS) {
        return Promise.resolve(RETURN_VALUE);
      } else {
        return Promise.reject('error');
      }
    });
    promises.retry(f, NUM_CALLS_BEFORE_SUCCESS + 1).then((result: string) => {
      expect(f.calls.count()).toEqual(NUM_CALLS_BEFORE_SUCCESS);
      expect(result).toEqual(RETURN_VALUE);
      done();
    });
  });

  it('stops calling after the max number of failures', (done) => {
    const f = jasmine.createSpy('spy');
    f.and.returnValue(Promise.reject(new Error(REJECT_MESSAGE)));
    promises.retry(f, MAX_ATTEMPTS).catch((e: Error) => {
      expect(f.calls.count()).toEqual(MAX_ATTEMPTS);
      expect(e.message).toEqual(REJECT_MESSAGE);
      done();
    });
  });
});
