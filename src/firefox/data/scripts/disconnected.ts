function stopProxying() {
  window.postMessage('stopUsingProxy', '*');
}
