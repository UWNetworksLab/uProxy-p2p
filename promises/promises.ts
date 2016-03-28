/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

// Invokes f up to maxAttempts number of times, resolving with its result
// on the first success and rejecting on maxAttempts-th failure.
export const retry = <T>(f: () => Promise<T>, maxAttempts: number): Promise<T> => {
  return f().catch((e:Error) => {
    --maxAttempts;
    if (maxAttempts > 0) {
      return retry(f, maxAttempts);
    } else {
      return Promise.reject(e);
    }
  });
};
