var script = document.createElement('script');
script.src = 'freedom-for-chrome/freedom-for-chrome.js';
document.head.appendChild(script);
script.onload = function() {
  freedom('uproxy-lib/uprobe/freedom-module.json', {
    'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then(function(moduleFactory) {
    moduleFactory();
  }, function() {
    console.error('could not load freedomjs module');
  });
};
