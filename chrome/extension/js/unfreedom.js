var freedom_listeners = {};
chrome.extension.getBackgroundPage().appPort.onMessage.addListener(function(msg) {
  if (freedom_listeners[msg.type]) {
    var handlers = freedom_listeners[msg.type].slice(0);
    for (var i = 0; i < handlers.length; i++) {
      if (handlers[i](msg.data) === false) {
        break;
      }
    }
  }
});

var freedom = {
  emit: function(a, b) {
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'emit',
      type: a,
      data: b
    });
  },
  on: function(t, h) {
    if (freedom_listeners[t]) {
      freedom_listeners[t].push(h);
    } else {
      freedom_listeners[t] = [h];
    }
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'on',
      type: t
    });
  },
  once: function(t, handler) {
    var func = function (data) {
      var idx = freedom_listeners[t].indexOf(this);
      freedom_listeners[t] = freedom_listeners[t].splice(idx, 1);
      handler(data);
    };
    if (freedom_listeners[t]) {
      freedom_listeners[t].push(func);
    } else {
      freedom_listeners[t] = [func];
    }
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'once',
      type: t
    });
  }
};
