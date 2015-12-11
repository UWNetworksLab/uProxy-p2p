chrome.app.runtime.onLaunched.addListener(function() {
  // Prevent the app from suspending.
  // TODO: Use persistent sockets instead:
  //       https://github.com/uProxy/uproxy/issues/1746
  chrome.app.window.create('index.html', {
  	id: "provision",
    outerBounds: {
      width: 200,
      height: 200,
    }
  });

  var script = document.createElement('script');
  script.src = 'freedom-for-chrome/freedom-for-chrome.js';
  document.head.appendChild(script);
  script.onload = function() {
    console.log('loading freedom!');
    freedom('uproxy-lib/cloud/digitalocean/freedom-module.json', {
      'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
      'debug': 'debug'
    }).then(function(moduleFactory) {
      var freedomModule = moduleFactory();
      window.freedomModule = freedomModule;
      freedomModule.on("status", function(msg) {
        console.log("status: " + msg.message);
      });
      freedomModule.start("test").then(function(ret) {
        console.log("start returns: ");
        console.log(ret);
      }).catch(function(err) {
        console.error("start errors: " + err);
      });
    }, function() {
      console.error('could not load freedomjs module');
    });
  };
});
