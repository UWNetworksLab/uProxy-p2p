interface Window {
  port :{ emit :(eventType :string, eventData :Object) => void;
          on :(eventType :string, handler :Function) => void; };
}

self.port.on('logs', function(logs) {
  window.postMessage({ logs : logs, data: false }, '*');
});


window.addEventListener('message', function(event) {
  if (event.data.update) {
    self.port.emit('update', event.data);
  }

  if (event.data.command) {
    self.port.emit('command', event.data);
  }

  if (event.data.showPanel) {
    self.port.emit('showPanel', event.data);
  }

  if (event.data.getLogs) {
    self.port.emit('getLogs', event.data);
  }
}, false);
