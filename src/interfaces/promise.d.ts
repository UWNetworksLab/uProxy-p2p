// Based on http://www.html5rocks.com/en/tutorials/es6/promises/#toc-api
// Promise Spec: http://promises-aplus.github.io/promises-spec/

interface Thenable<T> {
  then:(fulfill:(t?:T) => void,
        reject?:(e:Error) => void) => Thenable<T>;
}

/**
 * Generic Promise for built-in js Promises.
 *
 * T is the `fullfillment object` type given to onTulfilled function.
 *
 * The rejection object is always a javascript Error.
 */
declare class Promise<T> {

  constructor (f:(fulfill:(t?:T)=>void,
                  reject:(e:Error)=>void)=>void);

  // |onFulfilled| either returns a promise...
  then<T2> (fulfill:(t:T) => Promise<T2>,
            reject?:(e:Error) => Promise<T2>)
      :Promise<T2>;

  // or the next fulfillment object directly.
  then<T2> (fulfill?:(t:T) => T2,
            reject?:(e:Error) => T2)
      :Promise<T2>;

  catch (catchFn:(e:Error) => Promise<T>):Promise<T>;
  catch (catchFn:(e:Error) => T):Promise<T>;
  catch (catchFn:(e:Error) => void):Promise<void>;

  static resolve<T> (thenable:Thenable<T>)
      :Promise<T>;

  static resolve<T> (t:T)
      :Promise<T>;

  static resolve ()
      :Promise<void>;

  static reject<T> (e:Error)
      :Promise<T>;

  static all<T> (...args:Thenable<T>[])
      :Promise<T>;

  static race<T> (...args:Thenable<T>[])
      :Promise<T>;

}


// Add .stack attribute to Errors (which actually does exist in js).
interface Error {
  stack?:any;
}

