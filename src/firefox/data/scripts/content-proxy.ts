interface Window {
  port :{ emit :(eventType :string, eventData :Object) => void; };
}

window.addEventListener('message', function(event) {
  if (event.data.update) {
    self.port.emit('update', event.data);
  }

  if (event.data.command) {
    self.port.emit('command', event.data);
  }
}, false);
