/**
 * Forwards data from content script to freedom;
 * TODO(salomegeo): rewrite in typescript;
 * Figure out a way to avoid freeom -> add-on env -> content script -> add-on
 * for proxy setting and setting a main icon.
 */

var proxyConfig = require('lib/firefox_proxy_config.js').proxyConfig;

// TODO: rename uproxy.js/ts to uproxy-enums.js/ts
var uproxy_core_api = require('./interfaces/uproxy_core_api.js');
var { Ci, Cc, Cr } = require("chrome");
var self = require("sdk/self");
var events = require("sdk/system/events");
var notifications = require('sdk/notifications')
var pagemod = require('sdk/page-mod');
var tabs = require('sdk/tabs');


// If these values change in the uproxy-website source, they must
// be changed here as well. TODO: de-deduplicate?
var UPROXY_DOMAINS = ['www.uproxy.org', 'test-dot-uproxysite.appspot.com'];
var INSTALL_PAGE_PATH = '/install';
var PROMO_PARAM = 'pr';

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
    button.icon = iconFiles;
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

  panel.port.on('setBadgeNotification', function(notification) {
    button.badge = notification;
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

  /* Allow pages in the addon and uproxy.org to send messages to the UI or the core */
  var contentProxyFile = self.data.url('scripts/content-proxy.js');
  var urlsToProxyTo = [
    self.data.url('*'),
    'https://www.uproxy.org/*',
    'https://test-dot-uproxysite.appspot.com/*'
  ];
  pagemod.PageMod({
    include: urlsToProxyTo,
    contentScriptFile: contentProxyFile,
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


  // Check if user already has a tab open to the uProxy install page.
  for (var tab of tabs) {
    if (matchesUrlSet(tab.url, urlsToProxyTo)) {
      // Attach our content script to the existing tab.
      tab.attach({contentScriptFile: contentProxyFile});

      emitPromoIfFound(tab.url);
    }
  }

  // Attach a handler to check if a tab is opened in the future with a promo.
  tabs.on('pageshow', function (tab) {
    emitPromoIfFound(tab.url);
  });

  function matchesUrlSet(url, urlSet) {
    for (var u of urlSet) {
      if (u.endsWith('*')) {
        u = u.slice(0, -1);
      }
      if (url.startsWith(u)) {
        return true;
      }
    }
    return false;
  }

  /*
   * Return true iff the given URL corresponds to the uProxy install page.
   */
  function isInstallPage(url) {
    for (var domain of UPROXY_DOMAINS) {
      if (url.startsWith('https://' + domain + INSTALL_PAGE_PATH)) {
        return true;
      }
    }
    return false;
  }

  /*
   * Emit a promo event to the panel if a uProxy install promo is in
   * effect for the given URL.
   */
  function emitPromoIfFound(url) {
    if (!isInstallPage(url)) {
      return;
    }
    var iq = url.indexOf('?') + 1;
    if (!iq) {
      return;
    }
    var qs = url.substring(iq);
    var params = qs.split('&');
    for (var param of params) {
      var keyval = param.split('=');
      if (keyval[0] === PROMO_PARAM) {
        panel.port.emit('promoIdDetected', keyval[1]);
        break;
      }
    }
  }
}


exports.setUpConnection = setUpConnection;
