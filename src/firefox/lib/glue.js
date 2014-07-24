/**
 * Forwards data from content script to freedom;
 * TODO(salomegeo): rewrite in typescript;
 * Figure out a way to avoid freeom -> add-on env -> content script -> add-on
 * for proxy setting and setiing a main icon.
 */

var proxyConfig = require('firefox_proxy_config.js').proxyConfig;

function setUpConnection(freedom, panel, button) {
  function connect(command, from, to) {
    from.on(command, function(data) {
      to.emit(command, data);
    })
  }

  for (i = 2000; i < 2014; i++) {
    connect('' + i, freedom, panel.port);
  }

  for (i = 1000; i < 1014; i++) {
    connect('' + i, panel.port, freedom);
  }

  panel.port.on('startUsingProxy', function() {
    proxyConfig.startUsingProxy();
  });

  panel.port.on('stopUsingProxy', function() {
    proxyConfig.stopUsingProxy();
  });

  panel.port.on('setIcon', function(iconFile) {
    button.icon = {
      '19': './icons/' + iconFile,
    }
  });
}

exports.setUpConnection = setUpConnection
