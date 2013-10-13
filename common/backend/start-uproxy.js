

// Print info to console so you can find this web-worker
console.log('Uproxy backend, running in worker ' + self.location.href);

//XXX: Makes chrome debugging saner, not needed otherwise.
var window = {};

var log = {
  debug: DEBUG ? makeLogger('debug') : function(){},
  error: makeLogger('error')
};

// Storage is used for saving settings to the browsre local storage available
// to the extension.
var stateStorage = new UProxyState();
var state = stateStorage.state;


server.emit("start");
// Load state from storage and when done login to relevant networks and
// emit an total state update.
stateStorage.loadStateFromStorage(function () {
  for(var network in stateStorage.state.me.networkDefaults) {
    if (stateStorage.state.me.networkDefaults[network].autoconnect) {
      _Login(network);
    }
  }
  _SyncUI('',stateStorage.state);
});

// Now that this module has got itself setup, it sends a 'ready' message to the
// freedom background page.
uiChannel.emit('ready');
