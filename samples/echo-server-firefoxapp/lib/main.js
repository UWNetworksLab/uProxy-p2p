const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

var manifest = self.data.url("uproxy-lib/echo/freedom-module.json");
var loggingProviderManifest = self.data.url("uproxy-lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(echoFactory) {
  var echo = echoFactory();
  echo.emit('start', { address: '127.0.0.1', port: 9998 });
}, function() {
  console.error('could not load freedom');
});
