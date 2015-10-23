var freedom = require("freedom-for-node");
freedom.freedom('./uproxy-lib/zork/freedom-module.json', {
  'logger': './uproxy-lib/loggingprovider/freedom-module.json',
  'debug': 'debug'
}).then(function(moduleFactory) {
  moduleFactory();
}, function() {
  console.error('could not load freedomjs module');
});
