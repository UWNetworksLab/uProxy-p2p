var buttons = require('sdk/ui/button/action');
var panels = require("sdk/panel");
var self = require("sdk/self");
var tabs = require("sdk/tabs");
const {Cu} = require("chrome");
var {setTimeout} = require("sdk/timers");

Cu.import(self.data.url('freedom-for-firefox.jsm'));

var button = buttons.ActionButton({
  id: "uProxy-button",
  label: "uProxy-button",
  icon: {
    "16": "./icons/uproxy-16.png",
    "19": "./icons/uproxy-19.png",
    "128": "./icons/uproxy-128.png"
  },
  onClick: start
});


function start(state) {
  var manifest = self.data.url('../lib/uproxy.json');
  var freedom =
      setupFreedom(manifest, {
        freedomcfg: function(register) {
              register('core.view', require('view_googleauth.js').View_googleAuth);
            },
        portType: 'BackgroundFrame'
      });
  freedom.emit('login');
}
