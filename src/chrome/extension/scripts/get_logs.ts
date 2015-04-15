var extension_id = 'pjpcdnccaekokkkeheolmpkfifcbibnj';
var fulfillGetLogs;
var rejectGetLogs;
var getLogsPromise = new Promise(function (resolve, reject) {
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
