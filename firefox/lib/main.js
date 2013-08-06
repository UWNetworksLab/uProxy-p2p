var self = require("sdk/self");
var panel = require("sdk/panel");
var pageWorker = require("sdk/page-worker");
var freedomShim = require("./freedom_shim_extension");

var initFreeDOM = function() {
  var freedomPageWorker = pageWorker.Page({
    contentURL: self.data.url("freedom-page-worker.html")
  });
  var freedom = freedomShim.Freedom(freedomPageWorker);
  console.log(Object.keys(freedom));
  return freedom;
};

var initToolbar = function(freedom) {
  // create toolbarbutton
  var tbb = require("toolbarbutton").ToolbarButton({
    id: "UProxyItem",
    label: "UProxy",
    image: self.data.url("submodules/uproxy-common/images/uproxy-19.png"),
    panel: initPanel(freedom)
  });
  
  tbb.moveTo({
    toolbarID: "nav-bar",
    forceMove: false // only move from palette
  });
};

var initPanel = function(freedom) {
  var l10n = JSON.parse(self.data.load("l10n/en/messages.json"));
  var uproxyPanel = panel.Panel({
    contentURL: self.data.url("popup.html")
  });
  freedom.addContentContext(uproxyPanel);
  uproxyPanel.port.on("show", function() {
    uproxyPanel.port.emit("l10n", l10n);
  });
  return uproxyPanel;
};

var freedom = initFreeDOM();
initToolbar(freedom);

