var buttons = require('sdk/ui/button/action');
var panels = require("sdk/panel");
var self = require("sdk/self");
const {Cu} = require("chrome");

Cu.import(self.data.url('freedom-for-firefox.jsm'));

// Main uProxy button.
var button = buttons.ActionButton({
  id: "uProxy-button",
  label: "uProxy-button",
  icon: {
    "16": "./icons/uproxy-16.png",
    "19": "./icons/uproxy-19.png",
    "128": "./icons/uproxy-128.png"
  },
  onClick: start
});

var panel;

// Load freedom.
var manifest = self.data.url('core/freedom-module.json');
freedom(manifest, {}).then(function(uproxy) {
  // Panel that gets displayed when user clicks the button.
  panel = panels.Panel({
    width: 371,
    height: 600,
    contentURL: self.data.url("polymer/popup.html")
  })

  // Set up connection between freedom and content script.
  require('glue.js').setUpConnection(new uproxy(), panel, button);
});


function start(state) {
  panel.show({
    position: button,
  });
}
