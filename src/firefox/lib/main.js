var buttons = require('sdk/ui/button/action');
var panels = require("sdk/panel");
var self = require("sdk/self");
const {Cu} = require("chrome");

Cu.import(self.data.url('freedom-for-firefox/freedom-for-firefox.jsm'));

// Main uProxy button.
var button = buttons.ActionButton({
  id: "uProxy-button",
  label: "uProxy",
  icon: {
    "18": "./icons/19_offline.gif",
    "36": "./icons/38_offline.gif"
  },
  onClick: start
});

var panel;

// Load freedom.
var manifest = self.data.url('generic_core/freedom-module.json');
var loggingProviderManifest = self.data.url("uproxy-lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(uproxy) {
  // Panel that gets displayed when user clicks the button.
  panel = panels.Panel({
    width: 371,
    height: 600,
    contentURL: self.data.url("generic_ui/index.html")
  })

  // Set up connection between freedom and content script.
  require('glue.js').setUpConnection(new uproxy(), panel, button);
  require('url-handler.js').setup(panel, button);
});


function start(state) {
  panel.show({
    position: button,
  });
}
