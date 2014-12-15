var buttons = require('sdk/ui/button/action');
var panels = require("sdk/panel");
var self = require("sdk/self");
const {Cu} = require("chrome");

Cu.import(self.data.url('freedom-for-firefox-for-uproxy.jsm'));

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

// Panel that gets displayed when user clicks the button.
var panel = panels.Panel({
  width: 371,
  height: 600,
  contentURL: self.data.url("index.html"),
  contentScriptFile: [
    self.data.url("scripts/port.js"),
    self.data.url("scripts/user.js"),
    self.data.url("scripts/uproxy.js"),
    self.data.url("scripts/ui.js"),
    self.data.url("scripts/firefox_browser_api.js"),
    self.data.url("scripts/firefox_connector.js"),
    self.data.url("scripts/core_connector.js"),
    self.data.url("scripts/background.js")],
  contentScriptWhen: 'start'
})

// Load freedom.
var manifest = self.data.url('core/freedom-module.json');
var freedom =
    setupFreedom(manifest, {
      freedomcfg: function(register) {
            register('core.view', require('view_googleauth.js').View_googleAuth);
            register('core.storage', require('firefox_storage.js').Storage_firefox);
          },
      portType: 'BackgroundFrame'
    });

// Set up connection between freedom and content script.
require('glue.js').setUpConnection(freedom, panel, button);


function start(state) {
  panel.show({
    position: button,
  });
}
