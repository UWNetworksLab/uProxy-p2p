'use strict';

var chromeEvent = function() {
  var listeners = [];
  var event = {
    addListener: function addListener(listener) {
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
      for(var i = 0; i < listeners.length; i++) {
	listeners[i].apply(this, arguments);
      }
    }
  };
  return event;
};

angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    return function (key) {
      return "";
    };
  })
  .constant('freedom', freedom)
  .constant('onFreedomStateChange', chromeEvent())
  .constant('model', {})
  .run(['freedom', 'onFreedomStateChange', function(freedom, onFreedomStateChange) {
    freedom.onConnected = chromeEvent();
    freedom.onDisconnected = chromeEvent();

    freedom.onConnected.addListener(function () {
      freedom.on('state-change', function (patchMsg) {
	onFreedomStateChange.dispatch(patchMsg);
      });
    });

    freedom.connect = function() {
      this.connected = true;
      freedom.onConnected.dispatch();
    };
  }
       ]);
