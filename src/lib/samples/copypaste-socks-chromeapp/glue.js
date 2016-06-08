function loadModule() {
  return freedom('lib/copypaste-socks/freedom-module.json', {
    'logger': 'lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then(function(moduleFactory) {
    return moduleFactory();
  });
}
