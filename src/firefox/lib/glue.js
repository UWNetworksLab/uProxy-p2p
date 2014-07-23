/**
 * @fileoverview Description of this file.
 */

var proxyConfig = require('firefox_proxy_config.js').proxyConfig;

function setUpConnection(freedom, panel, button) {
  function connect(command, from, to) {
    from.on(command, function(data) {
      to.emit(command, data);
    })
  }

  for (i = 2000, i < 2014, i++) {
    connect('' + i, freedom, panel.port);
  }

  for (i = 1000, i < 1014, i++) {
    connect('' + i, panel.port, freedom);
  }

  panel.port.on('startUsingProxy', function(iconFile) {
    proxyConfig.startUsingProxy();
    button.icon = {
      '19': './icons/' + iconFile,
    }
  }
  panel.port.on('stopUsingProxy', function(iconFile) {
    proxyConfig.stopUsingProxy();
    button.icon = {
      '19': './icons/' + iconFile,
    }
  });
}

exports.setUpConnection = setUpConnection
