/**
 * Firefox local storage provider.
 * TODO(salomegeo): rewrite in typescript
 */

var ss = require("sdk/simple-storage");

var Storage_firefox = function(channel, dispatch) {
  this.dispatchEvents = dispatch;
  this.channel = channel;
  ss.storage.uproxy = {};
  ss.on('OverQuota', this.clear.bind(this));
  this.storage_ = ss.storage.uproxy;
};

Storage_firefox.prototype.keys = function(continuation) {
  var keys = [];
  continuation(keys);
};

Storage_firefox.prototype.get = function(key, continuation) {
  if (this.storage_[key]) {
    continuation(this.storage_[key]);
  } else {
    continuation(null);
  }
};

Storage_firefox.prototype.set = function(key, value, continuation) {
  this.storage_[key] = value;
  continuation();
};

Storage_firefox.prototype.remove = function(key, continuation) {
  delete this.storage_[key];
  continuation();
};

Storage_firefox.prototype.clear = function(continuation) {
  ss.storage.uproxy = {};
  this.storage_ = ss.storage.uproxy;
  continuation();
}

exports.Storage_firefox = Storage_firefox;
