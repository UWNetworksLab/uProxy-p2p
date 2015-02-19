/**
 * Forwards data from content script to freedom;
 * TODO(salomegeo): rewrite in typescript;
 * Figure out a way to avoid freeom -> add-on env -> content script -> add-on
 * for proxy setting and setiing a main icon.
 */

var proxyConfig = require('firefox_proxy_config.js').proxyConfig;

// TODO: rename uproxy.js/ts to uproxy-enums.js/ts
var uProxy = require('uproxy.js').uProxy;
var { Ci, Cr } = require("chrome");
var events = require("sdk/system/events");

// TODO: rename freedom to uProxyFreedomModule
function setUpConnection(freedom, panel, button) {
  function connect(command, from, to) {
    from.on(command, function(data) {
      to.emit(command, data);
    })
  }

  // Set up listeners between core and ui.
  for (var command in uProxy.Command) {
    if (typeof uProxy.Command[command] === 'number') {
      connect('' + uProxy.Command[command], panel.port, freedom);
    }
  }

  for (var update in uProxy.Update) {
    if (typeof uProxy.Update[update] === 'number') {
      connect('' + uProxy.Update[update], freedom, panel.port);
    }
  }

  panel.port.on('startUsingProxy', function(endpoint) {
    proxyConfig.startUsingProxy(endpoint);
  });

  panel.port.on('stopUsingProxy', function(askUser) {
    proxyConfig.stopUsingProxy(askUser);
  });

  panel.port.on('setIcon', function(iconFiles) {
    button.state("window", {
      icon : iconFiles
    });
  });

  panel.port.on('showPanel', function() {
    panel.show();
  });
}

exports.setUpConnection = setUpConnection
