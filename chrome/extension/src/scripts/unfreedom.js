'use strict';

var freedom, freedomListeners;

freedomListeners = {};
chrome.extension.getBackgroundPage().appPort.onMessage.addListener(function(msg) {
  if (freedomListeners[msg.type]) {
    var handlers = freedomListeners[msg.type].slice(0);
    for (var i = 0; i < handlers.length; i++) {
      if (handlers[i](msg.data) === false) {
        break;
      }
    }
  }
});

freedom = {
  emit: function(a, b) {
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'emit',
      type: a,
      data: b
    });
  },
  on: function(t, h) {
    if (freedomListeners[t]) {
      freedomListeners[t].push(h);
    } else {
      freedomListeners[t] = [h];
    }
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'on',
      type: t
    });
  },
  once: function(t, handler) {
    var func = function (data) {
      var idx = freedomListeners[t].indexOf(this);
      freedomListeners[t] = freedomListeners[t].splice(idx, 1);
      handler(data);
    };
    if (freedomListeners[t]) {
      freedomListeners[t].push(func);
    } else {
      freedomListeners[t] = [func];
    }
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'once',
      type: t
    });
  }
};
