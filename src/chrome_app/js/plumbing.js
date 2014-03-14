// This file must be included *after* the freedom script and manifest are
// loaded.
"use strict";

// The port that the extension connects to.
var extPort = null;
// A list of pending messages sent to the extension at the next possible
// instance.
var pendingMsgs = [];

// Remember which handlers freedom has installed.
var installedFreedomHooks = [];

// Constant ID of corresponding extension.
var EXTENSION_ID = 'opedeinldpclhihojdgahbpjnndkfmhe';

//var test_script = document.createElement('script');
//test_script.src = 'common/backend/test/sctp-peerconnection_test.js';
//document.head.appendChild(test_script);

var uProxyAppChannel = freedom;  // Guaranteed to exist.
uProxyAppChannel.on('ready', function() {
  console.log('uproxy.js is ready!');
});

// Called when an extension connects to the app.
chrome.runtime.onConnectExternal.addListener(function(port) {
  // Security: only allow the official uproxy extension to control the backend.
  // We don't want another extension secretly making you proxy others, or
  // trying to do something even worse.
  if (port.sender.id !== EXTENSION_ID ||
      port.name !== 'uproxy-extension-to-app-port') {
    console.log('Got connect from an unexpected extension id: ' +
        port.sender.id);
    return;
  }
  console.log('Connected to extension ' + EXTENSION_ID);
  extPort = port;  // Update to the current port.

  // Because there is no callback when you call runtime.connect and it
  // sucessfully connects, the extension depends on a message to come back to
  // it form here, the app, so it knows the connection was successful and the
  // app is indeed present.
  extPort.postMessage('hello.');
  // TODO: remove this testing code.
  // setTimeout(function() { extPort.postMessage("ignore me."); }, 10);
  extPort.onMessage.addListener(onExtMsg);

  for (var i = 0; i < pendingMsgs.length; i++) {
    console.log(pendingMsgs[i]);
    extPort.postMessage(pendingMsgs[i]);
  }
});


// Receive a message from the extension.
// This usually installs freedom handlers.
function onExtMsg(msg) {
  console.log('extension message: ', msg);

  if (msg.cmd == 'emit') {
    uProxyAppChannel.emit(msg.type, msg.data);
  } else if (msg.cmd == 'on') {
    if (installedFreedomHooks.indexOf(msg.type) >= 0) {
      console.log('freedom already has a hook for ' + msg.type);
      return;
    }
    installedFreedomHooks.push(msg.type);
    uProxyAppChannel.on(msg.type, function (ret) {
      extPort.postMessage({
        type: msg.type,
        data: ret
      });
    });
  }
};

console.log('Starting uProxy app...');
