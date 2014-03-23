//-----------------------------------------------------------------------------
// A simple task manager for use with Grunt. Avoids duplicate subtasks.
//
// Compile using the command:
// $ tsc --module commonjs tools/taskmanager.ts

//-----------------------------------------------------------------------------
// Assumes tasks have tree-shaped constructive dependencies: assumes that if a
// component was build once, then it never has to be build again in a single
// build run.
// i.e. given: A = [B,C,Z], B = [X1,X2], C = [X1,Y], then A = [X1,X2,Y,Z],
// i.e. only constraint is that index(X1) < index(Y), and that steps after
// X1 in B do not disrupt steps C.

module TaskManager {

  export interface Index { [s:string]: string[] };

  // The state of flattening a tree.
  class FlatteningState {
    // Flattened tree seen so far.
    flattened_: string[] = [];
    // Elements still to be flattened.
    queue_: string[] = [];
    // Elements seen.
    seen_: { [s:string] : boolean } = {};

    // Create an initial state with a single top-level name in the queue.
    constructor(name: string) {
      this.queue([name]);
    }

    // True when the given node name has been seen before.
    public haveSeen(name: string) { return (name in this.seen_); }

    // True all nodes have been flattened.
    public isFlattened() { return (this.queue_.length == 0); }

    // unfold a node in the flattening process. This either adds it to the
    // list of flattened nodes, or adds its children to the queue. Either way,
    // the node is marked as seen.
    unfoldNode(index : Index, name:string) {
      if(this.haveSeen(name)) { return; }
      this.seen_[name] = true;
      if(name in index) {
        this.queue(index[name]);
      } else {
        this.flattened_.push(name);
      }
    }

    // Add node names to the queue.
    public queue(toQueue : string[]) {
      this.queue_ = toQueue.concat(this.queue_);
    }

    // Flatten the state w.r.t. the given index.
    public flatten(index : Index) {
      var unfoldWrtIndex = this.unfoldNode.bind(this,index);
      while(!this.isFlattened()) {
        unfoldWrtIndex(this.queue_.shift());
      }
      return this.flattened_;
    }
  }


  export class Manager {
    // Index from task name to flattened and de-duped list of subtasks.
    private taskIndex_ : Index;

    constructor() {
      this.taskIndex_ = {};
    }

    // Assumes all tasks are defined before being added.
    public add(name : string, subtasks : string[]) {
      this.taskIndex_[name] = subtasks;
    }

    public getUnflattened(name : string) {
      if(! (name in this.taskIndex_)) {
        throw(name + " is not in taskIndex.");
      }
      return this.taskIndex_[name];
    }

    public get(name : string) {
      return (new FlatteningState(name)).flatten(this.taskIndex_);
    }

    public list() {
      return Object.keys(this.taskIndex_);
    }
  }  // class Manager

}  // module TaskManager
