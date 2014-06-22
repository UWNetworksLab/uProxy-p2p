/// <reference path='../third_party/promise/promise.d.ts' />

// Event Handler tools.
module Handler {

  // Simple interface for optional values. Can be used as follows:
  // Given |x :Maybe<string>| Then you can write stuff like:
  // |if (some in x) then return x.some; else throw new Error("none!");|
  interface Maybe<T> {
    some ?:T;
  }

  // The AggregateUntil interface allows internal storage of aggregation and any
  // other state, including time. |considerNext| adds a new input element, And
  // the |readyNow| function returns an optional aggregated output element if
  // the time & aggregation is right.
  interface AggregateUntil<T,T2> {
    considerNext   :(x:T) => void;
    readyNow       :() => Maybe<T2>;
  }

  // All handle calls get the same result for an aggregated collection of things in the queue.
  class AggregateUntilHandler<T,T2>() {
      private nextPromise_  :Promise<T2>;
      private fulfilNextFn_ :(x:T2) => void;
    constructor(public aggregator :AggregateUntil<T,T2>) {
      this.readyEvent_ = new UnitEventHandler<T2>();
      nextPromise_
    }

    private resetNextPromise_ = () => {
      this.nextPromise_ = new Promise((F,R) => { this.fulfilNextFn_ = F; });
    }

    // Returns true
    public tryNow = () => {
      var ready = aggregator.readyNow();
      if (!ready.some) {
        return false;
      }
      this.fulfilNextFn_(ready.some);
      this.resetNextPromise_();
      return true;
    }

    public handle = (x:T) => {
      aggregator.considerNext(x);
      var currentPromise = nextPromise_;
      tryNow();
      return currentPromise;
    }
  }

}
