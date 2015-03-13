(() => {
  var extension_id = 'pjpcdnccaekokkkeheolmpkfifcbibnj';
  chrome.runtime.sendMessage(extension_id, { openWindow: true });
})();
