/**
 * plumbing.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */
/// <reference path='../../../interfaces/uproxy.ts' />
/// <reference path='../../util/chrome_glue.ts' />

// The port that the extension connects to.
var extPort = null;
// A list of pending messages sent to the extension at the next possible
// instance.
var pendingMsgs = [];

// Remember which handlers freedom has installed.
var installedFreedomHooks = [];

// Constant ID of corresponding extension.
var EXTENSION_ID = 'pjpcdnccaekokkkeheolmpkfifcbibnj';

var uProxyAppChannel = freedom;  // Guaranteed to exist.
uProxyAppChannel.on('' + uProxy.Command.READY, () => {
  console.log('uProxy is ready!');
});

// Called when an extension connects to the app.
chrome.runtime.onConnectExternal.addListener((port) => {
  // Security: only allow the official uproxy extension to control the backend.
  // We don't want another extension secretly making you proxy others, or
  // trying to do something even worse.
  if (EXTENSION_ID !== port.sender.id ||
      port.name !== 'uproxy-extension-to-app-port') {
    console.warn('Got connect from an unexpected extension id: ' +
        port.sender.id);
    return;
  }
  console.log('Connected to extension ' + EXTENSION_ID);
  extPort = port;  // Update to the current port.

  // Because there is no callback when you call runtime.connect and it
  // sucessfully connects, the extension depends on a message to come back to
  // it form here, the app, so it knows the connection was successful and the
  // app is indeed present.
  extPort.postMessage(ChromeGlue.ACK);
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

  // Pass 'emit's from the UI to Core. These are uProxy.Commands.
  if ('emit' == msg.cmd) {
    uProxyAppChannel.emit(msg.type, msg.data);

  // Install onUpdate handlers by request from the UI.
  } else if ('on' == msg.cmd) {
    if (installedFreedomHooks.indexOf(msg.type) >= 0) {
      console.log('freedom already has a hook for ' + msg.type);
      return;
    }
    installedFreedomHooks.push(msg.type);
    // When it fires, send data back over Chrome App -> Extension port.
    uProxyAppChannel.on(msg.type, (ret) => {
      extPort.postMessage({
        type: msg.type,
        data: ret
      });
    });
  }
};

console.log('Starting uProxy app...');
