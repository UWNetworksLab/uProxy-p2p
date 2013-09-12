var self = require("sdk/self");
var panel = require("sdk/panel");
var pageMod = require("sdk/page-mod");

var initToolbar = function(freedom) {
  // create toolbarbutton
  var tbb = require("pathfinder/ui/toolbarbutton").ToolbarButton({
    id: "UProxyItem",
    label: "UProxy",
    image: self.data.url("submodules/uproxy-common/images/uproxy-19.png"),
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
    contentURL: self.data.url("popup.html"),
    width: 450,
    height: 300
  });
  freedomCommunicator.addContentContext(uproxyPanel);
  uproxyPanel.port.on("show", function() {
    uproxyPanel.port.emit("l10n", l10n);
  });
  return uproxyPanel;
};

// var optionsPanel = function(freedomCommunicator) {
//   var options = pageMod({
//     include: "",
//     contentScriptFile:[]
//     contentScriptWhen: "start"
//   });  
//   //freedomCommunicator.addContentContext(options);
//   options.show();
// };

var freedomEnvironment = require('./init_freedom').InitFreedom();

// TODO: Remove when uproxy.js no longer uses setTimeout
// and replace with the line:
// initToolbar(freedomEnvironment);
require('sdk/timers').setTimeout(initToolbar, 100, freedomEnvironment);
// optionsPanel(freedomEnvironment);
