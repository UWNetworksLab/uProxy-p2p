if (typeof org === 'undefined') var org = {};
if (!org.uproxy) org.uproxy = {};

org.uproxy.loadFreedom = function() {
 // Freedom must run after the window has loaded because the
  // data-manifest attribute isn't loaded yet, so we load freedom
  // dynamically.
  // This is a pretty nasty hack. For some reason appending a script
  // tag for freedom after the page has loaded doesn't do anything, so
  // we append the script tag and then use mozIJSSubScriptLoader to
  // actually run the script. Freedom will still think it loaded from
  // a script tag and pull the proper manifest file.
  var script = document.createElement('script');
  script.setAttribute("type", "application/javascript");
  script.setAttribute('data-manifest',
                      'chrome://uproxy-common/content/backend/uproxy.json');
  script.textContent = '{"strongIsolation": true, "stayLocal": true, "portType": "Worker"}';
  script.src = 'chrome://uproxy-freedom/content/freedom.js';
  document.documentElement.appendChild(script);

  var mozIJSSubScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
        .getService(Components.interfaces.mozIJSSubScriptLoader);

  // increase timeout to open debugger in time!
  setTimeout(function() {
    // Uncomment this line and use it when the npm version of freedom is updated
    // mozIJSSubScriptLoader.loadSubScript('chrome://uproxy-freedom/content/freedom.js');
    mozIJSSubScriptLoader.loadSubScript('chrome://uproxy-scraps/content/freedom.js');
  }, 1000);
};

window.addEventListener('load', function loadFreedom() {
  window.freedomcfg = function(register) {
    register('core.socket', org.uproxy.Socket_firefox);
    register('core.storage', org.uproxy.Storage_firefox);
  };
  org.uproxy.loadFreedom();
}, false);
