/**
 * A FreeDOM storage provider offers a key value store interface
 * with some level of persistance, and some size limitation.
 * @constructor
 * @private
 */
var Storage_chrome = function(channel) {
  this.channel = channel;
  handleEvents(this);
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

