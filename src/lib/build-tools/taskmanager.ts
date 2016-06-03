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
//
// Note: circular dependencies will result in a runtime error being thrown.

export interface Index { [s:string]: string[] };

// The state of flattening a tree containing only leaf nodes. The output
// keeps left-to-right order, and only contains the first occurence in the
// list of the node entry in the tree.
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


// Manager managed tasks so that you add entries with sub-entries, and you
// can get a flattened and de-duped list of leaf-tasks as output.
export class Manager {
  // The index of branch nodes in the tree with names of their children.
  private taskIndex_ : Index;

  constructor() {
    this.taskIndex_ = {};
  }

  // Depth first search keep track of path and checking for loops for each
  // new node. Returns list of all cycles found.
  public getCycles(name : string) : string[][] {
    // The |agenda| holds set of paths explored so far. The format for each
    // agenda entry is: [child, patent, grandparent, etc]
    // An invariant of the the agenda is that each member is a non-empty
    // string-list.
    var agenda : string[][]= [[name]];
    var cyclicPaths : string[][] = [];
    while (agenda.length > 0) {
      // Get the next path to explore further.
      var nextPath = agenda.shift();
      // If this is a non-leaf node, search all child nodes/paths
      var nodeToUnfold = nextPath[0];
      if(nodeToUnfold in this.taskIndex_) {
        // For each child of
        var children = this.taskIndex_[nodeToUnfold];
        children.forEach((child) => {
          // Extends the old path with a new one with child added to the
          // front. We use slice(0) to make a copy of the path.
          var newExtendedPath = nextPath.slice(0);
          newExtendedPath.unshift(child);
          if(nextPath.indexOf(child) !== -1) {
            cyclicPaths.push(newExtendedPath);
          } else {
            agenda.push(newExtendedPath);
          }
        });
      }
    }
    return cyclicPaths;
  }

  // The |add| method will throw an exception if a circular dependency is
  // added.
  public add(name : string, subtasks : string[]) {
    this.taskIndex_[name] = subtasks;

    // Check for resulting circular dependency.
    var cycles = this.getCycles(name);
    if(cycles.length > 0) {
      throw new Error('Cyclic dependencies: ' + cycles.toString());
    }
  }

  public getUnflattened(name : string) {
    if(! (name in this.taskIndex_)) {
      throw(name + ' is not in taskIndex.');
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
