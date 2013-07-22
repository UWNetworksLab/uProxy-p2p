var self = require("sdk/self");

var initToolbar = function() {
  // create toolbarbutton
  var tbb = require("toolbarbutton").ToolbarButton({
    id: "UProxyItem",
    label: "UProxy",
    image: self.data.url("uproxy-19.png"),
    onCommand: function () {
      //tbb.destroy(); // kills the toolbar button
    }
  });
 
  tbb.moveTo({
    toolbarID: "nav-bar",
    forceMove: false // only move from palette
  });
};

initToolbar();