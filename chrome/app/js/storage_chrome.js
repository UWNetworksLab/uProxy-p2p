/**
 * A storage provider using chrome's local extension storage pool.
 * @constructor
 */
var Storage_chrome = function(channel) {
  this.channel = channel;
};

Storage_chrome.prototype.get = function(key, continuation) {
  try {
    var val = chrome.storage.local.get(key, function(key, cb, items) {
      cb(items[key]);
    }.bind({}, key, continuation));
  } catch(e) {
    continuation(null);
  }
};

Storage_chrome.prototype.set = function(key, value, continuation) {
  chrome.storage.local.set({key: value}, continuation);
};

