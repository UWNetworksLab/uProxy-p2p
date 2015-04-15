function getLogs() {
  window.postMessage({ getLogs: true, data: false }, '*');
}

function bringUproxyToFront() {
  window.postMessage({ showPanel: true, data: false }, '*');
}

window.addEventListener('message', function(event) {
  if (event.data.logs) {
    document.querySelector('html /deep/ uproxy-logs').setAttribute('logs', event.data.logs);
  }
}, false);
