var self = require("sdk/self");
var panel = require("sdk/panel");
var pageMod = require("sdk/page-mod");

var initToolbar = function(freedom) {
  // create toolbarbutton
  var tbb = require("pathfinder/ui/toolbarbutton").ToolbarButton({
    id: "UProxyItem",
    label: "UProxy",
    image: self.data.url("common/ui/icons/uproxy-19.png"),
    panel: initPanel(freedom.communicator)
  });
  
  tbb.moveTo({
    toolbarID: "nav-bar",
    forceMove: false // only move from palette
  });
};

var initPanel = function(freedomCommunicator) {
  var l10n = JSON.parse(self.data.load("l10n/en/messages.json"));
  var uproxyPanel = panel.Panel({
    contentURL: self.data.url("common/ui/popup.html"),
    width: 450,
    height: 300
  });
  freedomCommunicator.addContentContext(uproxyPanel.port);
  uproxyPanel.port.on("show", function() {
    uproxyPanel.port.emit("l10n", l10n);
  });
  return uproxyPanel;
};

var optionsPageContentScript = function(freedomCommunicator) {
  var options = pageMod.PageMod({
    include: "resource://uproxyfirefox-at-universityofwashington/uproxy/data/common/ui/options.html",
    contentScriptFile:[self.data.url("scripts/freedom_shim_content.js"),
		       self.data.url("scripts/freedom_shim_freedom.js"),
		       self.data.url("scripts/event_on_emit_shim.js"),
		      self.data.url("scripts/content_script_communicator.js")],
    contentScriptWhen: "start",
    onAttach: function contentScriptAttached(worker) {
      console.log('Attaching scripts for options page.');
      freedomCommunicator.addContentContext(worker.port);
    }
  });
};

var freedomEnvironment = require('./init_freedom').InitFreedom();

// TODO: Remove when uproxy.js no longer uses setTimeout
// and replace with the line:
// initToolbar(freedomEnvironment);
require('sdk/timers').setTimeout(initToolbar, 500, freedomEnvironment);
require('sdk/timers').setTimeout(optionsPageContentScript, 500, freedomEnvironment.communicator);
