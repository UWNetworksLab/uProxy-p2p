// Since freedom-for-firefox can only be loaded by main.js, this
// returns an object that shuffles messages between main.js and
// the page via the port object:
//   https://developer.mozilla.org/en-US/Add-ons/SDK/Guides/Content_Scripts/using_port
function loadModule() {
  return Promise.resolve({
    on: function(name, callback) {
      addon.port.on(name, callback);
    },
    emit: function(name, data) {
      addon.port.emit(name, data);
    }
  });
}
