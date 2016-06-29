var freedom = require('freedom-for-node');

freedom.freedom('./lib/echo/freedom-module.json', {
  'logger': './lib/loggingprovider/freedom-module.json',
  'debug': 'debug'
}).then(function(moduleFactory) {
  moduleFactory();
}, function(e) {
  console.error('could not load freedomjs module: ' + e.message);
});
