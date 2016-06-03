const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");
var buttons = require('sdk/ui/button/action');
var panels = require("sdk/panel");

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

var manifest = self.data.url("lib/copypaste-socks/freedom-module.json");
var loggingProviderManifest = self.data.url("lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(moduleFactory) {
  var module = moduleFactory();

  var panel = panels.Panel({
    width: 450,
    height: 750,
    contentURL: self.data.url("main.html")
  })

  var button = buttons.ActionButton({
    id: "copypaste-button",
    label: "copy/paste SOCKS",
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
    'gotPeerSDP',
    'gatherMessage',
    'giveWithSDP',
    'publicKeyExport',
    'ciphertext',
    'verifyDecryptResult',
    'bytesReceived',
    'bytesSent',
    'proxyingStarted',
    'proxyingStopped'
  ];
  moduleSignalNames.forEach(function(signalName) {
    module.on(signalName, function(data) {
      panel.port.emit(signalName, data);
    });
  });

  var uiSignalNames = [
    'start',
    'stop',
    'friendKey',
    'signEncrypt',
    'controlPortCallback',
    'handleSignalMessage',
    'verifyDecrypt',
    'publicKeyExport',
    'gatherMessage',
    'giveWithSDP',
    'gotPeerSDP',
    'signalForPeer',
    'bytesReceived',
    'bytesSent',
    'proxyingStopped',
    'proxyingStarted',
    'ciphertext',
    'verifyDecryptResult'
  ];
  uiSignalNames.forEach(function(signalName) {
    panel.port.on(signalName, function(data) {
      module.emit(signalName, data);
    })
  });
}, function(e) {
  console.error('could not load freedom module: ' + e.message);
});
