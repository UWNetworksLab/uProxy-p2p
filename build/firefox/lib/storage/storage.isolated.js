/*globals freedom:true, location */
/*jslint indent:2,white:true,node:true,sloppy:true */
/**
 *  Implementation of storage that isolates the namespace
 *  for each instantiation of this provider
 *  Behavior:
 *    e.g. Both modules A and B use this storage provider.
 *    They cannot access each other's keys
 **/
'use strict';

function IsolatedStorageProvider(dispatchEvent) {
  var i;
  this.core = freedom.core();
  this.store = freedom['core.storage']();
  this.magic = "";
  this.queue = [];

  console.log("Before getId");
  this.core.getId().then(function (val) {
    console.log("After getId");
    for (i = 0; i < val.length; i += 1) {
      this.magic += val[i] + ";";
    }
    this.flushQueue();
  }.bind(this));
}

IsolatedStorageProvider.prototype.keys = function(continuation) {
  if (this.magic === "") {
    this.pushQueue("keys", null, null, continuation);
    return;
  }

  this.store.keys().then(function(val) {
    var result = [], i;
    //Check that our magic has been initialized
    //Only return keys in my partition
    for (i = 0; i < val.length; i += 1) {
      if (this.isMyKey(val[i])) {
        result.push(this.fromStoredKey(val[i]));
      }
    }
    continuation(result);
  }.bind(this));
};

IsolatedStorageProvider.prototype.get = function(key, continuation) {
  if (this.magic === "") {
    this.pushQueue("get", key, null, continuation);
    return;
  } 
  
  var promise = this.store.get(this.toStoredKey(key));
  promise.then(continuation);
};

IsolatedStorageProvider.prototype.set = function(key, value, continuation) {
  if (this.magic === "") {
    this.pushQueue("set", key, value, continuation);
    return;
  }

  var promise = this.store.set(this.toStoredKey(key), value);
  promise.then(continuation);
};

IsolatedStorageProvider.prototype.remove = function(key, continuation) {
  if (this.magic === "") {
    this.pushQueue("remove", key, null, continuation);
    return;
  }
  
  var promise = this.store.remove(this.toStoredKey(key));
  promise.then(continuation);
};

IsolatedStorageProvider.prototype.clear = function(continuation) {
  var promise = this.store.keys(), i;
  promise.then(function(keys) {
    //Only remove keys in my partition
    for (i = 0; i < keys.length; i += 1) {
      if (this.isMyKey(keys[i])) {
        this.store.remove(keys[i]);
      }
    }
    continuation();
  }.bind(this));
};

/** INTERNAL METHODS **/
//Insert call into queue
IsolatedStorageProvider.prototype.pushQueue = function(method, key, value, continuation) {
  this.queue.push({
    cmd: method,
    key: key,
    value: value,
    cont: continuation
  });
};

//Flush commands in queue
IsolatedStorageProvider.prototype.flushQueue = function() {
  var i, elt;
  for (i = 0; i < this.queue.length; i += 1) {
    elt = this.queue[i];
    if (elt.cmd === "keys") {
      this.keys(elt.cont);
    } else if (elt.cmd === "get") {
      this.get(elt.key, elt.cont);
    } else if (elt.cmd === "set") {
      this.set(elt.key, elt.value, elt.cont);
    } else if (elt.cmd === "remove") {
      this.remove(elt.key, elt.cont);
    } else {
      console.error("Isolated Storage: unrecognized command " + JSON.stringify(elt));
    }
  }

  this.queue = [];
};

// From caller's key => stored key
// e.g. 'keyA' => 'partition1+keyA'
IsolatedStorageProvider.prototype.toStoredKey = function(key) {
  return (this.magic + key);
};

// From stored key => caller's key
// e.g. 'partition1+keyA' => 'keyA'
IsolatedStorageProvider.prototype.fromStoredKey = function(key) {
  return key.substr(this.magic.length);
};

// Check if this stored key is in my partition
IsolatedStorageProvider.prototype.isMyKey = function(storedKey) {
  return (storedKey.substr(0, this.magic.length) === this.magic);
};

/** REGISTER PROVIDER **/
if (typeof freedom !== 'undefined') {
  freedom.storage().provideAsynchronous(IsolatedStorageProvider);
}
