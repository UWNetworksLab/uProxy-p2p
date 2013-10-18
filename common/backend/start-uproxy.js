/* global console, UProxyState, server, bgAppPageChannel */
// Print info to console so you can find this web-worker
console.log('Uproxy backend, running in worker ' + self.location.href);

//XXX: Makes chrome debugging saner, not needed otherwise.
var window = {};

// Storage is used for saving settings to the browsre local storage available
// to the extension.
var store = new UProxyState();

server.emit("start");

// Load state from storage and when done login to relevant networks and
// emit an total state update.
store.loadStateFromStorage(function () {
  for(var network in store.state.me.networkDefaults) {
    if (store.state.me.networkDefaults[network].autoconnect) {
      login(network, true);
    }
  }
  _SyncUI('',store.state);
});

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
bgAppPageChannel.emit('ready');
