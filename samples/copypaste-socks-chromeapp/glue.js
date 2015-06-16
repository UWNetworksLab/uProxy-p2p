function loadModule() {
  return freedom('uproxy-lib/copypaste-socks/freedom-module.json', {
    'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then(function(moduleFactory) {
    return moduleFactory();
  });
}
