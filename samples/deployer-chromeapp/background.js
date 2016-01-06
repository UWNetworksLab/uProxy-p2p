var script = document.createElement('script');
script.src = 'freedom-for-chrome/freedom-for-chrome.js';
document.head.appendChild(script);

script.onload = function() {
  freedom('uproxy-lib/cloud/deployer/freedom-module.json', {
    'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then(function(moduleFactory) {
    moduleFactory();
  }, function(e) {
    console.error('could not load freedomjs module: ' + e.message);
  });
}
