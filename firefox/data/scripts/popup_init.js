'use strict';

// TODO: There is a lot of stuff in the global scope that needs to be cleaned up

var chromeEvent = function() {
  var listeners = [];
  var event = {
    addListener: function addListener(listener) {
      console.log('adding listener');
      listeners.push(listener);
    },
    removeListener: function removeListener(listener) {
      for(var i = 0; i < listeners.length; i++) {
  if (listeners[i] === listener) {
    listeners.splice(i, 1);
    return;
  }
      }
    },
    dispatch: function dispatch() {
      console.log('dispatch called, looking for callbacks');
      for(var i = 0; i < listeners.length; i++) {
   console.log('dispatching event');
  listeners[i].apply(this, arguments);
      }
    }
  };
  return event;
};

var backgroundPage = {
  freedom: freedom,
  onFreedomStateChange: chromeEvent()
};

// Firefox does not have the same l10n & i18n interface as chrome,
// so it must be mocked.
// getMessage will be defined after the extension sends the popup the JSON
// with the internationalization data.
var chrome = {
  i18n: {
    getMessage: function () {
      return "";
    }
  },
  extension: {
    getBackgroundPage: function () {
      return backgroundPage;
    }
  },
  runtime: {
    id: -1
  }
};

freedom.connect = function() {};
freedom.connected = true;
freedom.onConnected = chromeEvent();
freedom.onDisconnected = chromeEvent();
freedom.on('state-change', function stateChangeHanlder(patch) {
  backgroundPage.onFreedomStateChange.dispatch(patch);
});

var communicator;
if (addon) {
  communicator = addon;
} else {
  communicator = self;
}

communicator.port.emit("show");
communicator.port.on("l10n", function(l10n) {
  chrome.i18n.getMessage = function(key) {
    return l10n['key'].message;
  };
});
