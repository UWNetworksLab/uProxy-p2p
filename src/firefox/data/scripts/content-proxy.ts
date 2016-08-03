interface Window {
  port :{ emit :(eventType :string, eventData :Object) => void;
          on :(eventType :string, handler :Function) => void; };
}

// self.port listens for messages from glue.js, which can communicate with
// the core and UI, and forwards them to pages with this content script
// loaded.
//TODO add better typing for message
self.port.on('message', function(message :any) {
  if (message.logs) {
    window.postMessage({ logs : message.data, data: false }, '*');
  }
});


// Listen for messages from pages where the content script is injected
// (e.g. disconnected.js)
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
}, false);

// Let the page which has loaded this content script know that uProxy is
// installed.
window.postMessage({ installed : true, data: false }, '*');
