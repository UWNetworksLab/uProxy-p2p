const {Cu} = require("chrome");
var self = require("sdk/self");
var {setTimeout} = require("sdk/timers");
var buttons = require('sdk/ui/button/action');
var panels = require("sdk/panel");

Cu.import(self.data.url("freedom-for-firefox/freedom-for-firefox.jsm"));

var button = buttons.ActionButton({
  id: "copypaste-button",
  label: "copy/paste SOCKS",
  icon: {
    "18": "./icons/19_offline.gif",
    "36": "./icons/38_offline.gif"
  },
  onClick: start
});

var panel;

var manifest = self.data.url("uproxy-lib/copypaste-socks/freedom-module.json");
var loggingProviderManifest = self.data.url("uproxy-lib/loggingprovider/freedom-module.json");
freedom(manifest, {
  'logger': loggingProviderManifest,
  'debug': 'debug'
}).then(function(moduleFactory) {
  var module = moduleFactory();

  panel = panels.Panel({
    width: 450,
    height: 625,
    contentURL: self.data.url("main.html")
  })
  panel.show();

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
    'proxyingStopped'];
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
    'getSendBack',
    'giveSendBack',
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
    'verifyDecryptResult'];
  uiSignalNames.forEach(function(signalName) {
    panel.port.on(signalName, function(data) {
      module.emit(signalName, data);
    })
  });
}, function(e) {
  console.error('could not load freedom module: ' + e.message);
});

function start(state) {
  panel.show({
    position: button,
  });
}
