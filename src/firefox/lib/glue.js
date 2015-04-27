/**
 * Forwards data from content script to freedom;
 * TODO(salomegeo): rewrite in typescript;
 * Figure out a way to avoid freeom -> add-on env -> content script -> add-on
 * for proxy setting and setiing a main icon.
 */

var proxyConfig = require('firefox_proxy_config.js').proxyConfig;
var xhr = require('firefox_xhr.js').xhr;

// TODO: rename uproxy.js/ts to uproxy-enums.js/ts
var uproxy_core_api = require('./interfaces/uproxy_core_api.js');
var { Ci, Cc, Cr } = require("chrome");
var self = require("sdk/self");
var events = require("sdk/system/events");
var notifications = require('sdk/notifications')
var pagemod = require('sdk/page-mod');

// TODO: rename freedom to uProxyFreedomModule
function setUpConnection(freedom, panel, button) {
  function connect(command, from, to) {
    from.on(command, function(data) {
      to.emit(command, data);
    })
  }

  function openURL(url) {
    var win = Cc['@mozilla.org/appshell/window-mediator;1']
        .getService(Ci.nsIWindowMediator)
        .getMostRecentWindow('navigator:browser');
    if (url.indexOf(':') < 0) {
      url = self.data.url(url);
    }
    win.gBrowser.selectedTab = win.gBrowser.addTab(url);
    panel.hide();
  }

  // Set up listeners between core and ui.
  for (var command in uproxy_core_api.Command) {
    if (typeof uproxy_core_api.Command[command] === 'number') {
      connect('' + uproxy_core_api.Command[command], panel.port, freedom);
    }
  }

  for (var update in uproxy_core_api.Update) {
    if (typeof uproxy_core_api.Update[update] === 'number') {
      connect('' + uproxy_core_api.Update[update], freedom, panel.port);
    }
  }

  panel.port.on('startUsingProxy', function(endpoint) {
    proxyConfig.startUsingProxy(endpoint);
  });

  panel.port.on('stopUsingProxy', function() {
    proxyConfig.stopUsingProxy();
  });

  panel.port.on('setIcon', function(iconFiles) {
    button.state("window", {
      icon : iconFiles
    });
  });

  panel.port.on('showPanel', function() {
    panel.show({
      position: button
    });
  });

  panel.port.on('openURL', function(url) {
    openURL(url);
  });

  panel.port.on('launchTabIfNotOpen', function(url) {
    // TODO: only launch if not open (https://github.com/uProxy/uproxy/issues/1124)
    openURL(url);
  });

  panel.port.on('showNotification', function(notification) {
    notifications.notify({
      text: notification.text,
      iconURL: './icons/128_online.png',
      data: notification.tag,
      onClick: function(data) {
        panel.port.emit('notificationClicked', data);
      }
    });
  });

  /**
   * Install a handler for promise emits received from the panel.
   * Promise emits return an ack or error to the panel.
   */
  function onPromiseEmit(message, handler) {
    console.log('on promise emit called');
    var promiseEmitHandler = function (args) {
      // Ensure promiseId is set for all requests
      if (!args.promiseId) {
        var err = 'onPromiseEmit called with message ' + message +
                  'with promiseId undefined';
        return Promise.reject(new Error(err));
      }

      // Call handler function, then return success or failure to the panel.
      handler(args.data).then(
        function (argsForCallback) {
          var fulfillData = {
            message: message,
            promiseId: args.promiseId,
            argsForCallback: argsForCallback
          };
          panel.port.emit('emitFulfilled', fulfillData);
        },
        function (errorForCallback) {
          var rejectionData = {
            promiseId: args.promiseId,
            errorForCallback: errorForCallback.toString()
          };
          panel.port.emit('emitRejected', rejectionData);
        }
      );
    }.bind(this);

    panel.port.on(message, function(args) {
      promiseEmitHandler(args);
    }.bind(this));
  };

  function post(data) {
    return xhr.frontedPost(data.data, data.externalDomain,
        data.cloudfrontDomain, data.cloudfrontPath);
  };

  // Ensure a fulfill or reject message will be sent back to the panel
  // when required by registering messages that initiate async behaviour.
  onPromiseEmit('frontedPost', post);

  /* Allow any pages in the addon to send messages to the UI or the core */
  pagemod.PageMod({
    include: self.data.url('*'),
    contentScriptFile: self.data.url('scripts/content-proxy.js'),
    onAttach: function(worker) {
      worker.port.on('update', function(data) {
        panel.port.emit(uproxy_core_api.Update[data.update], data.data);
      });

      worker.port.on('command', function(data) {
        freedom.emit(uproxy_core_api.Command[data.command], data.data);
      });

      // If we receive a getLogs message from a webpage (specifically
      // view-logs.html), make a call to get logs from the core, and intercept
      // the returned value when it is being passed to the UI with a
      // COMMAND_FULFILLED update.
      worker.port.on('getLogs', function(data) {
        freedom.emit(uproxy_core_api.Command.GET_LOGS, {data: data.data, promiseId: -1});
        var forwardLogsToContentScript = function(data) {
          if (data['command'] == uproxy_core_api.Command.GET_LOGS) {
            // Forward logs to content-proxy.js
            worker.port.emit('message', {
              logs: true,
              data: data.argsForCallback
            });
            freedom.off(uproxy_core_api.Update.COMMAND_FULFILLED,
              forwardLogsToContentScript);
          }
        };
        freedom.on(uproxy_core_api.Update.COMMAND_FULFILLED, forwardLogsToContentScript);
      });

      worker.port.on('showPanel', function(data) {
        panel.show({
          position: button
        });
      });
    }
  });
}

exports.setUpConnection = setUpConnection
