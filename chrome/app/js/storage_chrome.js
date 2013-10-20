/**
 * A storage provider using chrome's local extension storage pool.
 * @constructor
 */
var Storage_chrome = function(channel) {
  this.channel = channel;
  console.log('storage_chrome: worker ' + self.location.href);
};

Storage_chrome.prototype.get = function(key, continuation) {
  try {
    // console.log('storage_chrome: looking up ' + key);
    var val = chrome.storage.local.get(key, function(k, cb, items) {
      cb(items[k]);
    }.bind({}, key, continuation));
  } catch(e) {
    continuation(null);
  }
};

Storage_chrome.prototype.set = function(key, value, continuation) {
  // console.log('storage_chrome: saving ' + key);
  var diff = {};
  diff[key] = value;
  chrome.storage.local.set(diff, continuation);
};

Storage_chrome.prototype.remove = function(key, continuation) {
  // console.log('storage_chrome: removing ' + key);
  chrome.storage.local.remove(key, continuation);
};

Storage_chrome.prototype.clear = function(continuation) {
  // console.log('storage_chrome: clear all');
  chrome.storage.local.clear(continuation);
};
