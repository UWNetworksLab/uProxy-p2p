const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");
const {TextDecoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

const OPTIONS_FILE_PATH = '/zork-options';

// Returns Promise<boolean>
function checkIfMetricsEnabled() {
  return OS.File.read(OPTIONS_FILE_PATH).then(
    function onSuccess(array) {
      try {
        let decoder = new TextDecoder();
        let text = decoder.decode(array);
        let options = JSON.parse(text);
        return options['isMetricsEnabled'] === true;
      } catch (e) {
        console.error('Could not parse options file');
        return false;
      }
    }
  ).catch(function(e) {
    console.warn('Could not find options file');
    return false;  // Options file not found, not an error.
  });
}

var manifest = self.data.url("lib/zork/freedom-module.json");
var loggingProviderManifest = self.data.url("lib/loggingprovider/freedom-module.json");
var provider;
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(moduleFactory) {
  let provider = moduleFactory();
  checkIfMetricsEnabled().then(function(isEnabled) {
    provider.emit('setMetricsEnablement', isEnabled);
  });
}, function() {
  console.error('could not load freedomjs module');
});
