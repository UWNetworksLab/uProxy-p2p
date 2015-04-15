function stopProxying() {
  window.postMessage({ update: 'STOP_GETTING', data: false }, '*');
}

function getLogs() {
  window.postMessage({ getLogs: true, data: {promiseId: 9999999} }, '*');
}

function bringUproxyToFront() {
  window.postMessage({ showPanel: true, data: false }, '*');
}

window.addEventListener('message', function(event) {
  console.log('got message response!');
  console.log(event.data);
  if (event.data.logs) {
    document.querySelector('html /deep/ uproxy-logs').setAttribute('logs', event.data.logs);
  } else {
    document.querySelector('html /deep/ uproxy-logs').setAttribute('logs', 'Could not get logs');
  }
}, false);
