var self = require("sdk/self");
const { Cc, Ci, CC, Cr } = require('chrome');
const { Class } = require('sdk/core/heritage');

var mozIJSSubScriptLoader = Cc['@mozilla.org/moz/jssubscript-loader;1']
      .getService(Ci.mozIJSSubScriptLoader);
var shims = {};

shims.href = self.uri;

var FreedomCommunication = Class({
  type: "FreedomShim",
  initialize: function initialize(freedomWindow) {
    console.log('Initializing freedom communicator');
    if (!shims.freedomShim) {
      shims.addon = freedomWindow;
      mozIJSSubScriptLoader.loadSubScript(self.data.url('scripts/freedom_shim_content.js'), shims);
      mozIJSSubScriptLoader.loadSubScript(self.data.url('scripts/freedom_shim_freedom.js'), shims);
    }
  },
  addContentContext: function(context) {
    console.log('Adding context to freedom.');
    shims.freedomShim.addCommunicator(context);
  }
});

exports.FreedomCommunication = FreedomCommunication;
