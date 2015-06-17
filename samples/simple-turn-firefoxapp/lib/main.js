const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

var manifest = self.data.url("uproxy-lib/simple-turn/freedom-module.json");
var loggingProviderManifest = self.data.url("uproxy-lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(simpleTurnFactory) {
  var simpleSocks = simpleTurnFactory();
}, function() {
  console.error('could not load freedom');
});
