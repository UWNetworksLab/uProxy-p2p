var extPort;

chrome.runtime.onConnectExternal.addListener(function(port) {
  extPort = port;
  extPort.onMessage.addListener(onExtMsg);
});

function onExtMsg(msg) {
  if (msg.cmd == 'emit') {
    freedom.emit(msg.type, msg.data);
  } else if (msg.cmd == 'on') {
    freedom.on(msg.type, function (ret) {
      extPort.postMessage({
        type: msg.type,
        data: ret
      });
    });
  }
};

