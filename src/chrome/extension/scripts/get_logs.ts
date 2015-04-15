var extension_id = 'pjpcdnccaekokkkeheolmpkfifcbibnj';
var fulfillGetLogs :Function;
var rejectGetLogs :Function;
var getLogsPromise :Promise<string> = new Promise<string>((resolve, reject) => {
  fulfillGetLogs = resolve;
  rejectGetLogs = reject;
});

function getLogs() {
  chrome.runtime.sendMessage(extension_id,
      { getLogs: true },
      function (reply) {
        if (reply) {
          fulfillGetLogs(reply.logs);
        } else {
          rejectGetLogs('Could not get logs');
        }
      }
  );
  return getLogsPromise;
}

function bringUproxyToFront() {
  chrome.runtime.sendMessage(extension_id, { openWindow: true });
}
