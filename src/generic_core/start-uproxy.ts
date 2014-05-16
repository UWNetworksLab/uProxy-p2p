/**
 * start-uproxy.ts
 *
 * This is the entry point for the uProxy Core.
 * TODO: Possibly get rid of this file, since it's not actually doing much.
 */
/// <reference path='core.ts' />

// Print info to console so you can find this web-worker
console.log('Uproxy backend, running in worker ' + self.location.href);

// Always begin the RTC-to-net server.
rtcToNetServer.emit('start');

// TODO: Pull the UI adapter out into its own file, and initialize here.
declare var ui:UIConnector;

// Load state from storage and when done login to relevant networks and
// emit an total state update.
// store.loadStateFromStorage().then(function () {
  // for(var network in store.state.me.networkDefaults) {
    // if (store.state.me.networkDefaults[network].autoconnect) {
      // Core.login(network, true);
    // }
  // }
  // ui.sync();
// });

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
bgAppPageChannel.emit('ready', null);
