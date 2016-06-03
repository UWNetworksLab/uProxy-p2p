/// <reference path='../../../../third_party/typings/browser.d.ts' />

// Wraps asycnronous function calls, tracking the number of calls still
// resolving and invoking a function once that number reaches zero *and* a
// discard() function has been called.
// Intended for safely destroying freedomjs providers, which may emit
// disconnect notifications before all outstanding calls have resolved.
export class Counter {
  private counter_ = 0;

  private fulfillDestroyed_ :() => void;
  private rejectDestroyed_ :(e:Error) => void;
  private onceDestroyed_ = new Promise<void>((F, R) => {
    this.fulfillDestroyed_ = F;
    this.rejectDestroyed_ = R;
  });

  constructor(private destructor_ :() => void) {}

  // Calls f, keeping count of the number of calls yet to resolve.
  public wrap = <T>(f:() => Promise<T>) : Promise<T> => {
    // Should never throw.
    this.before_();
    return f().then((result:T) => {
      this.after_();
      return result;
    }, (e:Error) => {
      this.after_();
      throw e;
    });
  }

  public discard = () : void => {
    // By decrementing the counter without first incrementing it we can
    // help drive the counter to -1, the termination condition.
    this.after_();
  }

  public onceDestroyed = () : Promise<void> => {
    return this.onceDestroyed_;
  }

  private before_ = () : void => {
    this.counter_++;
  }

  private after_ = () : void => {
    this.counter_--;
    if (this.counter_ < 0) {
      try {
        this.destructor_();
        this.fulfillDestroyed_();
      } catch (e) {
        this.rejectDestroyed_(e);
      }
    }
  }
}
