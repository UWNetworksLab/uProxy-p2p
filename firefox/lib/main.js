var self = require("sdk/self");
var panel = require("sdk/panel");
var pageWorker = require("sdk/page-worker");
var freedomShim 
//const { Cu } = require("chrome");


var initFreeDOM = function() {
  var freedomPageWorker = pageWorker.Page({
    contentURL: self.data.url("freedom-page-worker.html")
  });
};

var initToolbar = function() {
  // create toolbarbutton
  var tbb = require("toolbarbutton").ToolbarButton({
    id: "UProxyItem",
    label: "UProxy",
    image: self.data.url("submodules/uproxy-common/images/uproxy-19.png"),
    panel: initPanel(),
    onCommand: function () {
      //tbb.destroy(); // kills the toolbar button
    }
  });
  
  tbb.moveTo({
    toolbarID: "nav-bar",
    forceMove: false // only move from palette
  });
};

var initPanel = function() {
  var l10n = JSON.parse(self.data.load("l10n/en/messages.json"));
  var uproxyPanel = panel.Panel({
    contentURL: self.data.url("popup.html")
  });
  uproxyPanel.port.on("show", function() {
    uproxyPanel.port.emit("l10n", l10n);
  });
  return uproxyPanel;
};

initFreeDOM();
initToolbar();
