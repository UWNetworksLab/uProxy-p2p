/// <reference path="../third_party/promise/promise.d.ts" />
declare module Handler {

  interface Aggregator<T, T2> {
    // Add something to be aggregated.
    input :(x:T) => void;
    // The |check| function returns null when aggregation is not ready. Returns
    // ab object of typed |T2| when aggregation is ready and the object of type
    // |T2| is the aggreated thing.
    check :() => T2;
  }

  // Aggregate handler for things of type |T| until the given |aggregator|
  // results in a |T2| for each handle of a |T| that contribted to the resulting
  // |T2|.
  class AggregateUntil<T, T2> {
    constructor(aggregator :Aggregator<T, T2>);

    // The aggregator being used.
    public aggregator :Aggregator<T, T2>;

    // Handle being given a new |T|. This will call |tryNext|.
    public handle :(x:T) => Promise<T2>;

    // The |tryNext| function will check if the aggregate of every |T| is now
    // ready to produce a new |T2|. If try returns |true| then a new
    // |nextAggregate| has been created and the old one has been fulfilled. If
    // |tryNext| returns |false| then |nextAggregate| is unchanged.
    public tryNext :() => boolean;

    //  A promise for the next aggregated |T2|. Note that when |tryNext| returns
    //  true, the nextAggregate will change to a new promise and the old one
    //  fill be fulfilled.
    public nextAggregate :Promise<T2>;
  }
}
