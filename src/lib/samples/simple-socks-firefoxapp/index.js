const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

var manifest = self.data.url("lib/simple-socks/freedom-module.json");
var loggingProviderManifest = self.data.url("lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(simpleSocksFactory) {
  var simpleSocks = simpleSocksFactory();
}, function() {
  console.error('could not load freedom');
});
