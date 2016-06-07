var script = document.createElement('script');
script.src = 'freedom-for-chrome/freedom-for-chrome.js';
document.head.appendChild(script);

// Keep a background timeout running continuously, to prevent chrome from
// putting the app to sleep.
function keepAlive() {
  setTimeout(keepAlive, 5000);
}
keepAlive();

script.onload = function() {
  freedom('lib/simple-socks/freedom-module.json', {
    'logger': 'lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then(function(moduleFactory) {
    moduleFactory();
  }, function(e) {
    console.error('could not load freedomjs module: ' + e.message);
  });
}
