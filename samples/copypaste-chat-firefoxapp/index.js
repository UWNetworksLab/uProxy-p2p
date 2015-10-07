const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");
var buttons = require('sdk/ui/button/action');
var panels = require("sdk/panel");

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

var manifest = self.data.url("uproxy-lib/copypaste-chat/freedom-module.json");
var loggingProviderManifest = self.data.url("uproxy-lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(moduleFactory) {
  var module = moduleFactory();

  var panel = panels.Panel({
    width: 800,
    height: 400,
    contentURL: self.data.url("main.html")
  })

  var button = buttons.ActionButton({
    id: "chat-button",
    label: "copypaste chat",
    icon: {
      "18": "./button.png"
    },
    onClick: function() {
      panel.show({
        position: button,
      });
    }
  });

  var moduleSignalNames = [
    'signalForPeer',
    'receive',
    'ready',
    'error'
  ];
  moduleSignalNames.forEach(function(signalName) {
    module.on(signalName, function(data) {
      panel.port.emit(signalName, data);
    });
  });

  var uiSignalNames = [
    'start',
    'handleSignalMessage',
    'send'
  ];
  uiSignalNames.forEach(function(signalName) {
    panel.port.on(signalName, function(data) {
      module.emit(signalName, data);
    })
  });
}, function(e) {
  console.error('could not load freedom module: ' + e.message);
});
