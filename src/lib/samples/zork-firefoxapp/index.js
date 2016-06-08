const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

var manifest = self.data.url("lib/zork/freedom-module.json");
var loggingProviderManifest = self.data.url("lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(moduleFactory) {
  moduleFactory();
}, function() {
  console.error('could not load freedomjs module');
});
