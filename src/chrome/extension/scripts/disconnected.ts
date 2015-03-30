function stopProxying() {
  var extension_id = 'pjpcdnccaekokkkeheolmpkfifcbibnj';
  chrome.runtime.sendMessage(extension_id, { stopProxying: true });
}
