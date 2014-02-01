function StorageProvider() {
  this.store = freedom['core.storage']();
  console.log("Storage Provider, running in worker " + self.location.href);
}

StorageProvider.prototype.get = function(key, continuation) {
  var promise = this.store.get(key);
  promise.done(function(val) {
    continuation(val);
  });
}

StorageProvider.prototype.set = function(key, value, continuation) {
  var promise = this.store.set(key, value);
  promise.done(continuation);
}

StorageProvider.prototype.remove = function(key, continuation) {
  var promise = this.store.remove(key);
  promise.done(continuation);
}

StorageProvider.prototype.clear = function(continuation) {
  var promise = this.store.clear();
  promise.done(continuation);
}

freedom.storage().provideAsynchronous(StorageProvider);
