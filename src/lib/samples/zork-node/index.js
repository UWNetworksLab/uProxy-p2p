var freedom = require("freedom-for-node");
freedom.freedom('./lib/zork/freedom-module.json', {
  'logger': './lib/loggingprovider/freedom-module.json',
  'debug': 'debug'
}).then(function(moduleFactory) {
  moduleFactory();
}, function() {
  console.error('could not load freedomjs module');
});
