var extPort;

chrome.runtime.onConnectExternal.addListener(function(port) {
  extPort = port;
  port.onMessage.addListener(onExtMsg);
});

function onExtMsg(msg) {
  console.log(msg);
};
