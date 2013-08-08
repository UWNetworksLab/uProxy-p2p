var extPort;
var pendingMsgs = [];

window.freedomcfg = function(register) {
  register("core.view", View_oauth);
  register("core.socket", Socket_chrome);
  register("core.storage", Storage_chrome);
}

var script = document.createElement('script');
script.setAttribute('data-manifest', 'submodules/uproxy-common/uproxy.json');
// Uncomment for clearer but less portable module error messages.
 script.textContent = '{"strongIsolation": true}';
script.src = 'submodules/uproxy-common/submodules/freedom/freedom.js';

document.head.appendChild(script);

chrome.runtime.onConnectExternal.addListener(function(port) {
  extPort = port;
  extPort.onMessage.addListener(onExtMsg);
  for (var i = 0; i < pendingMsgs.length; i++) {
    extPort.postMessage(pendingMsgs[i]);
  }
});

function sendMessage(msg) {
  if (extPort) {
    extPort.postMessage(msg);
  } else {
    pendingMsgs.push(msg);
  }
}

function onExtMsg(msg) {
  if (msg.cmd == 'emit') {
    freedom.emit(msg.type, msg.data);
  } else if (msg.cmd == 'on') {
    freedom.on(msg.type, function (ret) {
      extPort.postMessage({
        cmd: 'on',
        type: msg.type,
        data: ret
      });
    });
  } else if (msg.cmd == 'once') {
    freedom.once(msg.type, function (ret) {
      extPort.postMessage({
        cmd: 'once',
        type: msg.type,
        data: ret
      });
    });
  }
};
