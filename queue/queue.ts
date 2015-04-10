// This file defines a basic queue data structure, providing
// the standard Array push(), shift(), and length attributes,
// but with O(1) operation.

// Private helper class.
class Cell<T> {
  public next :Cell<T> = null;
  constructor(public item:T) {}
}

export class Queue<T> {
  private back_ :Cell<T> = null;
  private front_ :Cell<T> = null;
  public length :number = 0;

  constructor() {}

  // Add an item to the back of the queue.
  public push = (item:T) : void => {
    var cell = new Cell<T>(item);
    if (this.length > 0) {
      this.back_.next = cell;
    } else {
      // The queue was empty, so set both pointers.
      this.front_ = cell;
    }
    this.back_ = cell;
    this.length++;
  }

  // Remove and return the front element.
  public shift = () : T => {
    var dequeued = this.front_;
    // If this.front_ is this.back_, then getNext() returns null.
    this.front_ = dequeued.next;
    dequeued.next = null;  // Just to help the garbage collector.
    this.length--;
    if (this.length === 0) {
      this.back_ = null;
    }
    return dequeued.item;
  }
}  // class Queue
