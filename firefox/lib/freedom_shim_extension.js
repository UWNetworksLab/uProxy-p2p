var self = require("sdk/self");
const { Cc, Ci, CC, Cr } = require('chrome');
const { Class } = require('sdk/core/heritage');

var mozIJSSubScriptLoader = Cc['@mozilla.org/moz/jssubscript-loader;1']
      .getService(Ci.mozIJSSubScriptLoader);
var shims = {};

var FreedomCommunication = Class({
  type: "FreedomShim",
  initialize: function initialize(freedomWindow) {
    if (!shims.freedomShim) {
      shims.addon = freedomWindow;
      mozIJSSubScriptLoader.loadSubScript(self.data.url('scripts/freedom_shim_freedom.js'), shims);
      mozIJSSubScriptLoader.loadSubScript(self.data.url('scripts/freedom_shim_content.js'), shims);
    }
  },
  addContentContext: function(context) {
    shims.freedomShim.addCommunicator(context);
  }
});

exports.FreedomCommunication = FreedomCommunication;
