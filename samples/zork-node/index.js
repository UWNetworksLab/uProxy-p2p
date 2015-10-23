var freedom = require("freedom-for-node");
console.log('Loading sample app');
freedom('uproxy-lib/zork/freedom-module.json', {
  'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
  'debug': 'debug'
}).then(function(moduleFactory) {
  console.log("freedomjs module created");
  moduleFactory();
}, function() {
  console.error('could not load freedomjs module');
});
