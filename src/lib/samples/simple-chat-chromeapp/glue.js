function loadModule() {
  return freedom('lib/simple-chat/freedom-module.json', {
    'logger': 'lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then(function(moduleFactory) {
    return moduleFactory();
  });
}
