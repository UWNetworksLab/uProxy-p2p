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

// Invokes f with exponential backoff between retries, resolving with its result
// on the first success and rejecting on maxAttempts-th failure.
export const retryWithExponentialBackoff = <T>(f: () => Promise<T>,
    maxIntervalMs: number, initialIntervalMs: number): Promise<T> => {
  return f().catch((e: Error) => {
    initialIntervalMs *= 2;
    if (initialIntervalMs > maxIntervalMs) {
      return Promise.reject(e);
    }
    return new Promise<T>((F, R) => {
      setTimeout(() => {
        retryWithExponentialBackoff(f, maxIntervalMs, initialIntervalMs).then(F, R);
      }, initialIntervalMs);
    });
  });
};
