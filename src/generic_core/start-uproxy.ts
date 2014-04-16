/**
 * start-uproxy.ts
 *
 * This is the entry point for the uProxy Core.
 * It initializes Core.State, and emits a ready message to the UI if available.
 */
/// <reference path='core.ts' />

// Print info to console so you can find this web-worker
console.log('Uproxy backend, running in worker ' + self.location.href);


//XXX: Makes chrome debugging saner, not needed otherwise.
// var window :Window = {};

// Storage is used for saving settings to the browsre local storage available
// to the extension.
var store = new Core.State();

server.emit('start');

// Load state from storage and when done login to relevant networks and
// emit an total state update.
store.loadStateFromStorage().then(function () {
  for(var network in store.state.me.networkDefaults) {
    if (store.state.me.networkDefaults[network].autoconnect) {
      Core.login(network, true);
    }
  }
  sendFullStateToUI();
});

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
bgAppPageChannel.emit('ready', null);
