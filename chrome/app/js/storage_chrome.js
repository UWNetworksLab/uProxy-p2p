/**
 * A storage provider using chrome's local extension storage pool.
 * @constructor
 */
var Storage_chrome = function(channel) {
  this.channel = channel;
};

Storage_chrome.prototype.get = function(key, continuation) {
  try {
    var val = chrome.storage.local.get(key, function(k, cb, items) {
      cb(items[k]);
    }.bind({}, key, continuation));
  } catch(e) {
    continuation(null);
  }
};

Storage_chrome.prototype.set = function(key, value, continuation) {
  var diff = {};
  diff[key] = value;
  chrome.storage.local.set(diff, continuation);
};

