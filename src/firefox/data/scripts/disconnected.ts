function stopProxying() {
  window.postMessage({ update: 'STOP_GETTING', data: false }, '*');
}
