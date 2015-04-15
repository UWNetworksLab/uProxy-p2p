// Post messages to the content script, content-proxy.ts
function getLogs() {
  window.postMessage({ getLogs: true, data: false }, '*');
}

function bringUproxyToFront() {
  window.postMessage({ showPanel: true, data: false }, '*');
}

// Listen for messages from the content script
window.addEventListener('message', function(event) {
  if (event.data.logs) {
    var logsAndBrowserInfo = 'Browser Info: ' + navigator.userAgent + '\n\n' + event.data.logs;
    document.querySelector('html /deep/ uproxy-logs').setAttribute('logs', logsAndBrowserInfo);
  }
}, false);
