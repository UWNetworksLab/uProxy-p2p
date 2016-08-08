/// <reference path='../../../../third_party/typings/index.d.ts' />

// The |Aggregator| interface aggregates objects of type |T| to form a
// compound object of type |T2|. It may have internal data, including time
// which it uses as part of the aggregation. The |input| function adds a new
// input, and the |check| function returns an optional aggregated output. If
// the time/aggregate is not ready yet, |check| returns |null|. (Typically,
// calling |check| twice without an |input| in between will result in the null
// the second time; although this is not strictly enforced it is recommended).
export interface Aggregator<T,T2> {
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
export interface AggregateHandler<T, T2> {
  // Handle being given a new |T|. This will call |tryNext|.
  handle(x:T) : Promise<T2>;

  // The |tryNext| function will check if the aggregate of every |T| is now
  // ready to produce a new |T2|. If try returns |true| then a new
  // |nextAggregate| has been created and the old one has been fulfilled. If
  // |tryNext| returns |false| then |nextAggregate| is unchanged.
  tryNext() : boolean;

  //  A promise for the next aggregated |T2|. Note that when |tryNext| returns
  //  true, the nextAggregate will change to a new promise and the old one
  //  fill be fulfilled.
  nextAggregate() : Promise<T2>;
}

// All handle calls get the same result for an aggregated collection of things
// in the queue.
class AggregateHandlerClass<T,T2> implements AggregateHandler<T,T2> {

  // The |nextAggregate| is the Promise for next aggregated value.
  public nextAggregate_  :Promise<T2>;

  // fulfillNextFn_ is the internal function to fulfill the nextAggregate.
  private fulfillNextFn_ :(x:T2) => void;

  constructor(private aggregator_ :Aggregator<T,T2>) {
    this.resetNextPromise_();
  }

  private resetNextPromise_ = () : void => {
    this.nextAggregate_ = new Promise((F,R) => { this.fulfillNextFn_ = F; });
  }

  public nextAggregate() { return this.nextAggregate_; }

  // Checks to see if the aggregator can now aggregate the inputs. Returns
  // true if the old |nextAggregate| has been fulfilled and a new
  // |nextAggregate| has been created.
  public tryNext = () : boolean => {
    var result = this.aggregator_.check();
    if (result === null) {
      return false;
    }
    this.fulfillNextFn_(result);
    this.resetNextPromise_();
    return true;
  }

  // The handle function for aggregating elements. Note that all handle calls
  // of values will get the same aggregated reult promise.
  public handle = (x:T) : Promise<T2> => {
    this.aggregator_.input(x);
    var currentPromise = this.nextAggregate_;
    this.tryNext();
    return currentPromise;
  }
}

export function createAggregateHandler<T,T2>(aggregator :Aggregator<T,T2>)
    : AggregateHandler<T,T2> {
  return new AggregateHandlerClass(aggregator);
}
