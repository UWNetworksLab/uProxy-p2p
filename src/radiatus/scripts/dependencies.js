(function (exports) {
  var DEPENDENCIES = {
    CoreConnector: "scripts/core_connector.js",
    freedom: "/freedom.js"
  };
  var freedomRoot;

  var radiatusConnector = {
    status: {
      connected: false
    },
    send: function(payload, skipQueue) {
      if (typeof freedomRoot === 'undefined') {
        this._queue.push({cmd: 'send', args: [payload, skipQueue]});
        return;
      }
      freedomRoot.emit(payload.type+'', {data: payload.data, promiseId: payload.promiseId});
    },
    onUpdate: function(update, handler) {
      if (typeof freedomRoot === 'undefined') {
        this._queue.push({cmd: 'onUpdate', args: [update, handler]});
        return;
      }
      freedomRoot.on(update+'', handler);
    },
    _queue: [],
    _flushqueue: function() {
      for (var i=0; i<this._queue.length; i++) {
        var elt = this._queue[i];
        this[elt.cmd].apply(this, elt.args);
      }
      this._queue = [];
    }
  };

  var radiatusBrowserApi = {
    startUsingProxy: function(endPoint) {
      console.log('radiatusBrowserApi.startUsingProxy');
      console.log(endPoint);
    },
    stopUsingProxy: function(askUser) {
      console.log('radiatusBrowserApi.stopUsingProxy');
      console.log(askUser);
    },
    setIcon: function(iconFile) {
      console.log('radiatusBrowserApi.setIcon');
      console.log(iconFile);
    },
    openFaq: function(pageAnchor) {
      console.log('radiatusBrowserApi.openFaq');
      console.log(pageAnchor);
    },
    bringUproxyToFront: function() {},
  };

  
  function loadScript(url) {
    "use strict";
    var script = exports.document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    var topScript = exports.document.getElementsByTagName('script')[0];
    topScript.parentNode.insertBefore(script, topScript);
  }
  
  function haveDependencies() {
    "use strict";
    for (var dep in DEPENDENCIES) {
      if (DEPENDENCIES.hasOwnProperty(dep)) {
        if (!exports.hasOwnProperty(dep)) {
          return false;
        }
      }
    }
    return true;
  };

  function loadDependencies() {
    for (var dep in DEPENDENCIES) {
      if (DEPENDENCIES.hasOwnProperty(dep)) {
        if (!exports.hasOwnProperty(dep)) {
          loadScript(DEPENDENCIES[dep]);
        }
      }
    }
  }

  function init(retries) {
    if (!haveDependencies()) {
      if (retries > 0) {
        setTimeout(init.bind({}), (retries-1));
      } else {
        console.error("Error loading dependencies.js");
      }
      return;
    }
    // Load freedom stub
    freedom('freedom-module.json', {}).then(function(Root) {
      freedomRoot = new Root();
      radiatusConnector._flushQueue();
    });
    // Set exports.core and exports.ui
    // exports.model is set implicitly in ui.js
    if (typeof exports.core === 'undefined') {
      exports.core = new CoreConnector(radiatusConnector);
    }
    if (typeof exports.ui === 'undefined') {
      exports.ui = new UI.UserInterface(exports.core, radiatusBrowserApi);
    }

  }

  // Start
  loadDependencies();
  init(50);
})(window);
