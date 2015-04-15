var extension_id = 'pjpcdnccaekokkkeheolmpkfifcbibnj';

function stopProxying() {
  chrome.runtime.sendMessage(extension_id, { stopProxying: true });
}

function getLogs() {
  chrome.runtime.sendMessage(extension_id,
      { getLogs: true },
      function (reply) {
        console.log('got message response!');
        if (reply) {
          document.querySelector('html /deep/ uproxy-logs').setAttribute('logs', reply.logs);
        } else {
          document.querySelector('html /deep/ uproxy-logs').setAttribute('logs', 'Could not get logs');
        }
      }
  );
}

function bringUproxyToFront() {
  chrome.runtime.sendMessage(extension_id, { openWindow: true });
}
