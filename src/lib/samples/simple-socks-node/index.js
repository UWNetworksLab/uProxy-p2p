var freedom = require('freedom-for-node');

freedom.freedom('./uproxy-lib/simple-socks/freedom-module.json', {
  'logger': './uproxy-lib/loggingprovider/freedom-module.json',
  'debug': 'debug'
}).then(function(moduleFactory) {
  moduleFactory();
}, function(e) {
  console.error('could not load freedomjs module: ' + e.message);
});
