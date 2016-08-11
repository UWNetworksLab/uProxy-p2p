/// <reference path='../../../third_party/typings/index.d.ts' />

// Invokes f up to maxAttempts number of times, resolving with its result
// on the first success and rejecting on the maxAttempts-th failure, waiting,
// if specified, intervalMs ms between each attempt.
export const retry = <T>(f: () => Promise<T>, maxAttempts: number, intervalMs = 0): Promise<T> => {
  return f().catch((e: Error) => {
    return maxAttempts <= 1 ? Promise.reject(e) : new Promise<T>((F, R) => {
      setTimeout(() => {
        retry(f, maxAttempts - 1, intervalMs).then(F, R);
      }, intervalMs);
    });
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
