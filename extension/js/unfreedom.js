var freedom_handlers = {}
chrome.extension.getBackgroundPage().appPort.onMessage.addListener(function(msg) {
  freedom_handlers[msg.type](msg.data);
});

var freedom = {
  emit: function(a, b) {
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'emit',
      type: a,
      data: b
    });
  },
  on: function(a, b) {
    freedom_handlers[a] = b;
    chrome.extension.getBackgroundPage().appPort.postMessage({
      cmd: 'on',
      type: a
    });
  },
  once: function(a, b) {

  }
};
