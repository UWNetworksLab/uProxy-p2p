var self = require("sdk/self");
var panel = require("sdk/panel");

var initToolbar = function() {
  // create toolbarbutton
  var tbb = require("toolbarbutton").ToolbarButton({
    id: "UProxyItem",
    label: "UProxy",
    image: self.data.url("images/uproxy-19.png"),
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
  var uproxyPanel = panel.Panel({
                                 contentURL: self.data.url("popup.html")
				});
  return uproxyPanel;
};

initToolbar();