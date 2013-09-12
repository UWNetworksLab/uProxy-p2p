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
    }
  },
  addContentContext: function(context) {
    shims.freedomShim.addCommunicator(context);
  }
});


mozIJSSubScriptLoader.loadSubScript(self.data.url('js/freedom_shim_freedom.js'), shims);
mozIJSSubScriptLoader.loadSubScript(self.data.url('js/freedom_shim_content.js'), shims);

/**
 * @param {freedomWindow} The window in which the freedom module resides
 */
var FreedomCommunication = function(freedomWindow) {
  var contextWindows = [];
  freedomWindow.port.on('freedom_shim', function(args) {
    for (var i = 0; i < contextWindows.length; i++) {
      contextWindows[i].port.emit('freedom_shim', args);
    }
  });
  var freedom = {
    addContentContext: function(context) {
      console.log('Adding context window to freedom');
      contextWindows.push(context);

      context.port.on("freedom_shim_listen", function(event) {
	freedomWindow.port.emit("freedom_shim_listen", event);
      });

      context.port.on("freedom_shim", function(args) {
	freedomWindow.port.emit('freedom_shim', args);
      });
    }};
  return freedom;
};

exports.FreedomCommunication = FreedomCommunication;
