//-----------------------------------------------------------------------------
// A simple task manager for use with Grunt. Removes duplicate subtasks.
//
// To compile:
//   shell$ tsc --module commonjs tools/taskmanager.ts
;

// The state of flattening a tree.
var FlatteningState = (function () {
    // Create an initial state with a single top-level name in the queue.
    function FlatteningState(name) {
        // Flattened tree seen so far.
        this.flattened_ = [];
        // Elements still to be flattened.
        this.queue_ = [];
        // Elements seen.
        this.seen_ = {};
        this.queue([name]);
    }
    // True when the given node name has been seen before.
    FlatteningState.prototype.haveSeen = function (name) {
        return (name in this.seen_);
    };

    // True all nodes have been flattened.
    FlatteningState.prototype.isFlattened = function () {
        return (this.queue_.length == 0);
    };

    // unfold a node in the flattening process. This either adds it to the
    // list of flattened nodes, or adds its children to the queue. Either way,
    // the node is marked as seen.
    FlatteningState.prototype.unfoldNode = function (index, name) {
        if (this.haveSeen(name)) {
            return;
        }
        this.seen_[name] = true;
        if (name in index) {
            this.queue(index[name]);
        } else {
            this.flattened_.push(name);
        }
    };

    // Add node names to the queue.
    FlatteningState.prototype.queue = function (toQueue) {
        this.queue_ = toQueue.concat(this.queue_);
    };

    // Flatten the state w.r.t. the given index.
    FlatteningState.prototype.flatten = function (index) {
        var unfoldWrtIndex = this.unfoldNode.bind(this, index);
        while (!this.isFlattened()) {
            unfoldWrtIndex(this.queue_.shift());
        }
        return this.flattened_;
    };
    return FlatteningState;
})();

var Manager = (function () {
    function Manager() {
        // Index from task name to flattened and de-duped list of subtasks.
        this.taskIndex = {};
    }
    // Assumes all tasks are defined before being added.
    Manager.prototype.add = function (name, subtasks) {
        this.taskIndex[name] = subtasks;
    };

    Manager.prototype.getUnflattened = function (name) {
        if (!(name in this.taskIndex)) {
            throw (name + " is not in taskIndex.");
        }
        return this.taskIndex[name];
    };

    Manager.prototype.get = function (name) {
        return (new FlatteningState(name)).flatten(this.taskIndex);
    };

    Manager.prototype.list = function () {
        return Object.keys(this.taskIndex);
    };
    return Manager;
})();
exports.Manager = Manager;
