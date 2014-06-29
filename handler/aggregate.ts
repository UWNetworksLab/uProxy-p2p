/// <reference path='../third_party/promise/promise.d.ts' />

module Handler {

  // The |Aggregator| interface aggregates objects of type |T| to form a
  // compound object of type |T2|. It may have internal data, including time
  // which it uses as part of the aggregation. The |input| function adds a new
  // input, and the |check| function returns an optional aggregated output. If
  // the time/aggregate is not ready yet, |check| returns |null|. (Typically,
  // calling |check| twice without an |input| in between will result in the null
  // the second time; although this is not strictly enforced it is recommended).
  export interface Aggregator<T,T2> {
    input          :(x:T) => void;
    check          :() => T2;  // Note: T2 object returned may be null;
  }

  // All handle calls get the same result for an aggregated collection of things
  // in the queue.
  export class AggregateHandler<T,T2> {

    // The |nextAggregate| is the Promise for next aggregated value.
    public nextAggregate  :Promise<T2>;

    // fulfillNextFn_ is the internal function to fulfill the nextAggregate.
    private fulfillNextFn_ :(x:T2) => void;

    constructor(public aggregator :Aggregator<T,T2>) {
      this.resetNextPromise_();
    }

    private resetNextPromise_ = () : void => {
      this.nextAggregate = new Promise((F,R) => { this.fulfillNextFn_ = F; });
    }

    // Checks to see if the aggregator can now aggregate the inputs. Returns
    // true if the old |nextAggregate| has been fulfilled and a new
    // |nextAggregate| has been created.
    public tryNext = () : boolean => {
      var result = this.aggregator.check();
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
      this.aggregator.input(x);
      var currentPromise = this.nextAggregate;
      this.tryNext();
      return currentPromise;
    }
  }

}
