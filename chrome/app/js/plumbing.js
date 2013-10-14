"use strict";

// The port that the extension connects to.
var extPort;
// A list of pending messages sent to the extension at the next possible
// instance.
var pendingMsgs = [];
// true iff extension has connected to the app and extPort is connected.
var connectedToExtension = false;
// Constant
var EXTENSION_ID = 'opedeinldpclhihojdgahbpjnndkfmhe';

window.freedomcfg = function(register) {
  register("core.view", View_oauth);
  register("core.socket", Socket_chrome);
  register("core.storage", Storage_chrome);
}

var script = document.createElement('script');
script.setAttribute('data-manifest', 'common/backend/uproxy.json');
// Uncomment for clearer but less portable module error messages.
script.textContent = '{"strongIsolation": true, "stayLocal": true, "debug": false}';
script.src = 'common/freedom/freedom.js';
document.head.appendChild(script);

// Once the script had loaded, uProxyAppChannel is set to freedom, which is a channel to the
var uProxyAppChannel = null;
script.onload = function() {
  uProxyAppChannel = freedom;
  uProxyAppChannel.on('ready', function() {
    console.log("uproxy.js is ready!");
    //uProxyAppChannel.emit('start-proxy-localhost-test');
  });

  //var test_script = document.createElement('script');
  //test_script.src = 'common/backend/test/sctp-peerconnection_test.js';
  //document.head.appendChild(test_script);
};


// Called when an extension connects to the app.
chrome.runtime.onConnectExternal.addListener(function(port) {
  // Security: only allow the official uproxy extension to control the backend.
  // We don't want another extension secretly making you proxy others, or
  // trying to do something even worse.
  if (port.sender.id !== EXTENSION_ID ||
      port.name !== 'uproxy-extension-to-app-port') {
    console.log("Got connect from an unexpected extension id: "
        + port.sender.id);
    return;
  }

  extPort = port;

  // Because there is no callback when you call runtime.connect and it
  // sucessfully connects, the extension depends on a message to come back to
  // it form here, the app, so it knows the connection was successful and the
  // app is indeed present.
  extPort.postMessage("hello.");

  // TODO: remove this testing code.
  // setTimeout(function() { extPort.postMessage("ignore me."); }, 10);

  extPort.onMessage.addListener(onExtMsg);
  for (var i = 0; i < pendingMsgs.length; i++) {
    extPort.postMessage(pendingMsgs[i]);
  }
  connectedToExtension = true;
});

function sendMessage(msg) {
  if (extPort) {
    extPort.postMessage(msg);
  } else {
    pendingMsgs.push(msg);
  }
}

function onExtMsg(msg) {
  console.log('got message from extension... ');
  console.log(msg);

  if (msg.cmd == 'emit') {
    uProxyAppChannel.emit(msg.type, msg.data);
  } else if (msg.cmd == 'on') {
    uProxyAppChannel.on(msg.type, function (ret) {
      extPort.postMessage({
        cmd: 'on',
        type: msg.type,
        data: ret
      });
    });
  } else if (msg.cmd == 'once') {
    uProxyAppChannel.once(msg.type, function (ret) {
      extPort.postMessage({
        cmd: 'once',
        type: msg.type,
        data: ret
      });
    });
  }
};
