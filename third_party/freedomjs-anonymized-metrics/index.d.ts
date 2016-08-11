// Typings for freedomjs-anonymized-metrics:
//   https://github.com/willscott/freedomjs-anonymized-metrics

interface freedom_AnonymizedMetrics {
  report(key :string, value :string|number) : Promise<void>;
  retrieve() : Promise<Object>;
  retrieveUnsafe() : Promise<Object>;
}
