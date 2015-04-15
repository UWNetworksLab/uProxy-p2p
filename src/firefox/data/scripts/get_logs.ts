var fulfillGetLogs;
var rejectGetLogs;
var getLogsPromise = new Promise(function (resolve, reject) {
  fulfillGetLogs = resolve;
  rejectGetLogs = reject;
});

// Post messages to the content script, content-proxy.ts
function getLogs() {
  window.postMessage({ getLogs: true, data: false }, '*');
  return getLogsPromise;
}

function bringUproxyToFront() {
  window.postMessage({ showPanel: true, data: false }, '*');
}

// Listen for messages from the content script
window.addEventListener('message', function(event) {
  if (event.data.logs) {
    fulfillGetLogs(event.data.logs);
  }
  // TODO: add timeout for when to reject getLogs promise.
}, false);
