/**
 * @license tbd - something open.
 * see: https://github.com/UWNetworksLab/freedom
 */
(function (global) {
  var freedom_src = arguments.callee.toString();
  "use strict";
  var context,
      setup;

  if (typeof global['freedom'] !== 'undefined') {
    return;
  }
/**
 * Helper function for iterating over an array backwards. If the func
 * returns a true value, it will break out of the loop.
 */
function eachReverse(ary, func) {
  if (ary) {
    var i;
    for (i = ary.length - 1; i > -1; i -= 1) {
      if (ary[i] && func(ary[i], i, ary)) {
        break;
      }
    }
  }
}

function hasProp(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Cycles over properties in an object and calls a function for each
 * property value. If the function returns a truthy value, then the
 * iteration is stopped.
 */
function eachProp(obj, func) {
  var prop;
  for (prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      if (func(obj[prop], prop)) {
        break;
      }
    }
  }
}

/**
 * Simple function to mix in properties from source into target,
 * but only if target does not already have a property of the same name.
 * This is not robust in IE for transferring methods that match
 * Object.prototype names, but the uses of mixin here seem unlikely to
 * trigger a problem related to that.
 */
function mixin(target, source, force, deepStringMixin) {
  if (source) {
    eachProp(source, function (value, prop) {
      if (force || !hasProp(target, prop)) {
        if (deepStringMixin && typeof value !== 'string') {
          if (!target[prop]) {
            target[prop] = {};
          }
          mixin(target[prop], value, force, deepStringMixin);
        } else {
          target[prop] = value;
        }
      }
    });
  }
  return target;
}

/**
 * Add 'on' and 'emit' methods to an object, which act as a light weight
 * event handling structure.
 */
function handleEvents(obj) {
  var eventState = {
    listeners: {},
    conditional: [],
    oneshots: {},
    onceConditional: []
  };

  obj['on'] = function(type, handler) {
    if (typeof type === 'function') {
      this.conditional.push([type, handler]);
    } else if (this.listeners[type]) {
      this.listeners[type].push(handler);
    } else {
      this.listeners[type] = [handler];
    }
  }.bind(eventState);

  obj['once'] = function(type, handler) {
    if (typeof type === 'function') {
      this.onceConditional.push([type, handler]);
    } else if (this.oneshots[type]) {
      this.oneshots[type].push(handler);
    } else {
      this.oneshots[type] = [handler];
    }
  }.bind(eventState);

  obj['emit'] = function(type, data) {
    if (this.listeners[type]) {
      for (var i = 0; i < this.listeners[type].length; i++) {
        if (this.listeners[type][i](data) === false) {
          return;
        }
      }
    }
    if (this.oneshots[type]) {
      for (var i = 0; i < this.oneshots[type].length; i++) {
        this.oneshots[type][i](data);
      }
      this.oneshots[type] = [];
    }
    for (var i = 0; i < this.conditional.length; i++) {
      if (this.conditional[i][0](type, data)) {
        this.conditional[i][1](data);
      }
    }
    for (var i = this.onceConditional.length - 1; i >= 0; i--) {
      if (this.onceConditional[i][0](type, data)) {
        var cond = this.onceConditional.splice(i, 1);
        cond[0][1](data);
      }
    }
  }.bind(eventState);
}

/**
 * Determine if execution is working in a web worker,
 * Or a direct browser page.
 */
function isAppContext() {
  return (typeof window === 'undefined');
}

/**
 * Advertise the presence of an active freedom app to initiate interaction
 * with an installled / priveleged freedom context.
 */
function advertise() {
  // TODO: Firefox rejects cross site requests, so this approach will not work.
  // Figure out a new way to advertise to the addon.
  // var xhr = new XMLHttpRequest();
  // xhr.open('GET', 'http://127.3733366/advertise.js', true);
  // window.addEventListener('message', function(m) {
  //   if (m.source == window && m.data.type == 'freedomAdvertisementResponse') {
  //     console.log("Fdom advertisement response");
  //   }
  // });
  // xhr.send();
  // setTimeout(function() {
  //   xhr.abort();
  // }, 50);
  // TODO: Determine a mechanism by which to restrict responses by non-priveledged code.
  if (location.protocol === 'chrome-extension:' && typeof freedomcfg !== "undefined") {
    freedomcfg(fdom.apis.register.bind(fdom.apis));
  }
}

/**
 * Find all scripts on the given page.
 */
function scripts() {
    return document.getElementsByTagName('script');
}

/**
 * Make a relative URL absolute, based on the current location.
 */
function makeAbsolute(url) {
  var base = location.protocol + "//" + location.host + location.pathname;
  return resolvePath(url, base);
}

/**
 * Resolve a url against a defined base location.
 */
function resolvePath(url, from) {
  var protocols = ["http", "https", "chrome-extension"];
  for (var i = 0; i < protocols.length; i++) {
    if (url.indexOf(protocols[i] + "://") === 0) {
      return url;
    }
  }

  var dirname = from.substr(0, from.lastIndexOf("/"));
  var protocolIdx = dirname.indexOf("://");
  var pathIdx = protocolIdx + 3 + dirname.substr(protocolIdx + 3).indexOf("/");
  var path = dirname.substr(pathIdx);
  var base = dirname.substr(0, pathIdx);
  if (url.indexOf("/") === 0) {
    return base + url;
  } else {
    return base + path + "/" + url;
  }
}
var fdom = fdom || {};

/**
 * Defines fdom.Hub, the core message hub between freedom modules.
 * Incomming messages from apps are sent to hub.onMessage()
 * Use fdom.Hub.get() for the singleton instance.
 * @private
 * @constructor
 */
fdom.Hub = function() {
  this.config = {};
  this.apps = {};
  this.pipes = {};
  this.unbound = [];
  handleEvents(this);
};

/**
 * Singleton accessor for fdom.Hub.
 * @returns {fdom.Hub} The singleton freedom hub interconnecting freedom modules.
 */
fdom.Hub.get = function() {
  if (!fdom.Hub._hub) {
    console.log("fdom hub made");
    fdom.Hub._hub = new fdom.Hub();
  }
  return fdom.Hub._hub;
};

/**
 * Handle an incoming message from a freedom app.
 * @param {fdom.app} app The app sending the message.
 * @param {Object} message The sent message.
 */
fdom.Hub.prototype.onMessage = function(app, message) {
  if (!this.apps[app.id]) {
    console.warn("Message dropped from unregistered app " + app.id);
    return;
  }
  var flows = this.pipes[app.id];
  var flow = message.sourceFlow;
  var destChannel = flows[flow];

  if (flow == 'control') {
    if (this.debug("control") && message.request != 'debug') {
      console.log(app.id + " -C " + message.request);
    } else if (this.config['debug'] && message.request == 'debug') {
      console.log(app.id + " -D " + message.msg);
    }
    // Signaling Channel.
    if (message.request == 'dep') {
      this.createPipe(app, message.dep);
    } else if (message.request == 'create') {
      var config = {
        "debug": this.config['debug']
      };

      app.postMessage({
        sourceFlow: 'control',
        msg: {
          id: app.id,
          manifest: app.manifest,
          config: config
        }
      });
      this.permitAccess(app.id);
    } else if (message.request == 'ready') {
      app.ready();
    } else if (message.request == 'channel') {
      // Register new unprivileged message channel.
      var flow = 'custom' + Math.random();

      // Binding a channel.
      if (message.to) {
        var aid = message.to[0];
        var dep = this.apps[aid];
        var endpoint = false;
        for (var i = 0; i < this.unbound.length; i++) {
          if (this.unbound[i][0] == dep) {
            endpoint = this.unbound[i];
            this.unbound.splice(i, 1);
            break;
          }
        }
        if (endpoint) {
          var other = endpoint[0];
          if (this.pipes[app.id][flow] || this.pipes[other.id][endpoint[1]]) {
            console.warn("unwilling to redefine existing pipes.");
          } else {
            this.pipes[app.id][flow] = other.getChannel(endpoint[1]);
            this.pipes[other.id][endpoint[1]] = app.getChannel(flow);
          }
        }
      } else {
        // TODO: make sure apps can't make infinite unbound pipes.
        this.unbound.push([app, flow]);
      }

      app.postMessage({
        sourceFlow: 'control',
        msg: {
          flow: flow
        }
      });
    }
  } else if (destChannel) {
    if (this.debug("channels")) {
      console.log(app.id + " -> " + flow + " " + message.msg.action + " " + message.msg.type);
    }

    // Deliver Message
    if (destChannel == app.getChannel(flow)) {
      destChannel.onMessage(message.msg);
    } else {
      destChannel.postMessage(message.msg);
    }
  } else {
    var af = []
    for(var i in flows) {
      af.push(i);
    }
    console.warn("Message dropped from unregistered flow " + app.id + " -> " + flow);
    console.log(message.msg);
  }
};

/**
 * Ensure than an application is enstantiated. and registered.
 * @param {String} id The URL identifying the app.
 */
fdom.Hub.prototype.ensureApp = function(id) {
  var canonicalId = makeAbsolute(id);
  if (!this.apps[canonicalId]) {
    var newApp = new fdom.app.External();
    newApp.configure(this.config);
    newApp.configure({
      manifest: canonicalId
    });
    this.apps[canonicalId] = newApp;
  }
  return canonicalId;
}

/**
 * Establish a communication channel between an application and one of its dependencies.
 * @param {fdom.app} app The application establishing communication.
 * @param {String} dep The identifier of the dependency.
 */
fdom.Hub.prototype.createPipe = function(app, dep) {
  // 1. Make sure source has permissions to create the pipe.
  if (!app.manifest['dependencies'].hasOwnProperty(dep)) {
    console.warn("Dependency requested that was undeclared in app manifest");
    return false;
  }

  // 2. Make sure the dependency exists.
  var depId = this.ensureApp(app.manifest['dependencies'][dep]);
  var depApp = this.apps[depId];

  // 3. Register the link
  this.pipes[app.id][dep] = depApp.getChannel('default');
  this.pipes[depId] = {'default': app.getChannel(dep)};
}

/**
 * Register an application with the hub.
 * @param {fdom.app} app The application to register. 
 */
fdom.Hub.prototype.register = function(app) {
  if (!this.apps[app.id]) {
    this.apps[app.id] = app;
    this.pipes[app.id] = {'default' : app.channels['default']};
  }
  this['emit']('register', app);
}

/**
 * Register permissions of a freedom application.
 * @param String id The application for whom to register permissions.
 * @private
 */
fdom.Hub.prototype.permitAccess = function(id) {
  if (!this.apps[id]) {
    console.warn("Registration requested for unknown App " + id);
    return;
  }
  if (!this.apps[id].manifest['permissions']) {
    return;
  }
  for (var i = 0; i < this.apps[id].manifest['permissions'].length; i++) {
    var permission = this.apps[id].manifest['permissions'][i];
    if (permission.indexOf("core.") === 0) {
      this.pipes[id][permission] = fdom.apis.getCore(permission, this.apps[id].getChannel(permission));
    }
  }
}

/**
 * Bind an unbound app channel to a service implementing 'postMessage'.
 */
fdom.Hub.prototype.bindChannel = function(id, flow, service) {
  var dep = this.apps[id];
  var endpoint = false;
  for (var i = 0; i < this.unbound.length; i++) {
    if (this.unbound[i][0] == dep) {
      endpoint = this.unbound[i];
      this.unbound.splice(i, 1);
      break;
    }
  }
  if (endpoint) {
    if (this.pipes[endpoint[0].id][endpoint[1]]) {
      console.warn("unwilling to redefine existing pipes.");
    } else {
      if (this.debug("pipes")) {
        console.log("Custom channel bound: " + endpoint[1]);
      }
      this.pipes[endpoint[0].id][endpoint[1]] = service;
      return true;
    }
  }
  return false;
};

/**
 * Decide which messages to debug, if debugging enabled.
 */
fdom.Hub.prototype.debug = function(feature) {
  return this.config['debug'] === true || (this.config['debug'] !== false &&
      this.config['debug'].indexOf(feature) > -1);
}
var fdom = fdom || {};

/**
 * The API registry for FreeDOM.  Used to look up requested APIs,
 * and provides a bridge for core APIs to act like normal APIs.
 * @constructor
 */
var api = function() {
  this.apis = {};
  this.providers = {};
}

/**
 * Get an API.
 * @param {String} api The API name to get.
 * @returns {{name:String, definition:API}?} The API if registered.
 */
api.prototype.get = function(api) {
  if (!this.apis[api]) {
    return false;
  }
  return {
    name: api,
    definition: this.apis[api]
  }
}

/**
 * Set an API to a definition.
 * @param {String} name The API name.
 * @param {API} definition The JSON object defining the API.
 */
api.prototype.set = function(name, definition) {
  this.apis[name] = definition;
}

/**
 * Register a core API provider.
 * @param {String} name the API name.
 * @param {Function} constructor the function to create a provider for the API.
 */
api.prototype.register = function(name, constructor) {
  this.providers[name] = constructor;
}

/**
 * Get a core API connected to a given FreeDOM module.
 * @param {String} name the API to retrieve.
 * @param {fdom.Channel} you The communication channel to the API.
 * @returns {coreProvider} A fdom.App look-alike to a local API definition.
 */
api.prototype.getCore = function(name, you) {
  return new coreProvider(name, you);
}

/**
 * Bind a core API to a preexisting channel.
 * @param {String} name the API to bind.
 * @param {fdom.Channel} channel The Channel to terminate with the Core API.
 */
api.prototype.bindCore = function(name, channel) {
  var def = fdom.apis.get(name).definition;
  var endpoint = new fdom.Proxy(channel, def, true);

  var resolver = makeAbsolute.bind({});
  if (channel.app) {
    resolver = function(base, file) {
      return resolvePath(file, base);
    }.bind({}, channel.app.id);
  }
  
  endpoint['provideAsynchronous'](fdom.apis.providers[name].bind({}, channel, resolver));
  return endpoint;
}

/**
 * A core API provider, implementing the fdom.Proxy interface.
 * @param {String} name The core provider name
 * @param {fdom.Channel} channel The communication channel from the provider.
 * @constructor
 */
var coreProvider = function(name, channel) {
  this.instance = null;
  this.name = name;
  this.channel = channel;
}

/**
 * Send a message to this core provider.
 * @param {Object} msg The message to post.
 */
coreProvider.prototype.postMessage = function(msg) {
  if (!this.instance) {
    this.instance = fdom.apis.bindCore(this.name, this.channel);
  }
  this.channel['emit']('message', msg);
}

/**
 * Defines fdom.apis for fdom module registry and core provider registation.
 */
fdom.apis = new api();
var fdom = fdom || {};
fdom.app = fdom.app || {};

/**
 * The external interface for a freedom application.
 * Manages all active channels for the application, and allows
 * proxy objects to be created for them.  Also manages the
 * canonical view of the metadata for the application.
 * @constructor
 */
fdom.app.External = function() {
  this.id;
  this.config = {
    manifest: 'manifest.json',
    source: 'freedom.js'
  };
  this.channels = {};
  this.manifest = {};
  this.worker = null;
  this.state = false;
  
  handleEvents(this);
}

/**
 * Configure the App based on global FreeDOM configuration.
 * @param {Object} config global freedom Properties.
 */
fdom.app.External.prototype.configure = function(config) {
  mixin(fdom.Hub.get().config, config);
  mixin(this.config, config, true);
}

/**
 * Get a publically visible object for a given Channel.
 * @param {String?} flow The channel to provide a proxy for. If no channel
 *     is specified, the default channel will be used.
 * @returns {fdom.Proxy} a proxy object for the requested flow.
 */
fdom.app.External.prototype.getProxy = function(flow) {
  var channel = this.getChannel(flow);

  var proxy = new fdom.Proxy(channel);
  if (!this.config.exports) {
    this.config.exports = proxy;
  }
  return proxy;
}

/**
 * Get a communication channel for an application.  The Channel
 * is used to pass messages in and out of the application, and
 * specifies one 'link' between freedom modules.
 * @param {String?} flow The identifier for the channel. If none is specified
 *     the default channel will be used.
 * @returns {fdom.Channel} a channel for the requested flow.
 */
fdom.app.External.prototype.getChannel = function(flow) {
  if (!this.manifest || !this.id) {
    this.id = makeAbsolute(this.config.manifest);
    this.loadManifest(this.id);
  }
  
  if (!flow) {
    flow = 'default'
  }
  if (!this.channels[flow]) {
    this.channels[flow] = new fdom.Channel(this, flow);
  }
  return this.channels[flow];
}

/**
 * Load the description of the app.
 * @param {String} manifest The canonical URL of the application.
 * @private
 */
fdom.app.External.prototype.loadManifest = function(manifest) {
  var ref = new XMLHttpRequest();
  ref.addEventListener('readystatechange', function(e) {
    if (ref.readyState == 4 && ref.responseText) {
      var resp = {};
      try {
        resp = JSON.parse(ref.responseText);
      } catch(e) {
        return errback(e);
      }
      this.onManifest(resp);
    } else if (ref.readyState == 4) {
      console.warn(ref.status);
    }
  }.bind(this), false);
  ref.open("GET", manifest, true);
  ref.send();
}

/**
 * Callback for availability of Application Manifest.
 * Registers and starts the application.
 * @param {Object} manifest The application manifest.
 * @private
 */
fdom.app.External.prototype.onManifest = function(manifest) {
  if (manifest && manifest['app'] && manifest['app']['script']) {
    this.manifest = manifest;
    fdom.Hub.get().register(this);
    this['emit']('manifest');
    this.start();
  } else {
    console.warn(manifest['name'] + " does not specify a valid application.");
  }
}

/**
 * Start the application context, and activate a communication channel to the
 * remote javascript execution engine.
 * @private
 */
fdom.app.External.prototype.start = function() {
  if (this.worker) {
    this.worker.terminate();
    this.worker = null;
    this.state = false;
  }
  var blob = new Blob([this.config.src], {type: 'text/javascript'});
  this.worker = new Worker(URL.createObjectURL(blob));
  this.worker.addEventListener('message', function(msg) {
    fdom.Hub.get().onMessage(this, msg.data);
  }.bind(this), true);
};

/**
 * Mark the application context ready, and deliver queued messages to the
 * worker process.
 */
fdom.app.External.prototype.ready = function() {
  this.state = true;
  this['emit']('ready');
}

/**
 * Send a raw message to the application.
 * This interface is expected to be used by channels to send to the application,
 * and by the Hub to manage application lifecycle.
 * @param {Object} msg The message to send.
 */
fdom.app.External.prototype.postMessage = function(msg) {
  if (this.state || (this.worker && msg.sourceFlow == "control")) {
    this.worker.postMessage(msg);
  } else {
    this['once']('ready', function(m) {
      this.postMessage(m);
    }.bind(this, msg));
  }
}
var fdom = fdom || {};
fdom.app = fdom.app || {};

/**
 * The internal interface for a freedom application.
 * Manages all active channels for the application, and allows
 * proxy objects to be created for them.
 * @constructor
 */
fdom.app.Internal = function() {
  this.id;
  this.config = {};
  this.channels = {};
  this.manifest = {};
  handleEvents(this);
}

fdom.app.Internal.prototype.configure = function(config) {
  mixin(this.config, config, true);
}

fdom.app.Internal.prototype.getChannel = function(flow) {
  if (!this.manifest || !this.id) {
    this.start();
  }

  if (!flow) {
    flow = 'default'
  }

  if (!this.channels[flow]) {
    this.channels[flow] = new fdom.Channel(this, flow);
  }
  return this.channels[flow];
}
  
fdom.app.Internal.prototype.getProxy = function(flow) {
  var proxy = new fdom.Proxy(this.getChannel(flow));
  if (!this.config.exports) {
    this.config.exports = proxy;
  }
  return proxy;
}

/**
 * Start communication back to the executor.
 */
fdom.app.Internal.prototype.start = function() {
  this.config.global.addEventListener('message', function(msg) {
    if (msg.data && msg.data.sourceFlow) {
      var chan = this.channels[msg.data.sourceFlow];
      if (chan) {
        chan.onMessage(msg.data.msg);
      } else if (msg.data && msg.data.sourceFlow == 'control') {
        this['emit']('message', msg);
      }
    }
  }.bind(this), true);

  // Wait to get information about this application from the creator.
  this['once']('message', function(control) {
    this.id = control.data.msg.id;
    this.manifest = control.data.msg.manifest;
    this.configure(control.data.msg.config);
    
    this.loadPermissions();
    this.loadDependencies();
    this.loadProvides();

    this.postMessage({
      sourceFlow: 'control',
      request: 'ready'
    });

    var is = importScripts;
    importScripts = function(prefix, src) {
      try {
        is(resolvePath(src, prefix));
      } catch (e) {
        console.log(e.message+'\n'+e.stack);
      }
    }.bind({}, this.id);

    var appURL = resolvePath(this.manifest['app']['script'], this.id);
    importScripts(appURL);
  }.bind(this));
  
  // Post creation message to get the info.
  this.postMessage({
    sourceFlow: 'control',
    request: 'create'
  });
}

fdom.app.Internal.prototype.postMessage = function(msg) {
  this.config.global.postMessage(msg);
}

fdom.app.Internal.prototype.debug = function(msg) {
  if (this.config.debug) {
    this.postMessage({
      sourceFlow: 'control',
      request: 'debug',
      msg: msg.toString()
    });
  }
}

fdom.app.Internal.prototype.loadPermissions = function() {
  var permissions = [];
  var exp = this.config.exports;
  if(this.manifest && this.manifest['permissions']) {
    for (var i = 0; i < this.manifest['permissions'].length; i++) {
      permissions.push(this.manifest['permissions'][i]);
    }
  }
  for (var i = 0; i < permissions.length; i++) {
    var api = fdom.apis.get(permissions[i]);
    if (!api) {
      continue;
    }
    exp[api.name] = function(n, dfn) {
      var proxy = new fdom.Proxy(this.getChannel(n), dfn);
      return proxy;
    }.bind(this, api.name, api.definition);
  }

  //Core API is handled locally, to facilitate channel setup.
  var coreAPI = fdom.apis.get('core');
  var pipe = fdom.Channel.pipe();
  fdom.apis.bindCore('core', pipe[1]);
  exp['core'] = new fdom.Proxy(pipe[0], coreAPI.definition);
}

fdom.app.Internal.prototype.loadDependencies = function() {
  if(this.manifest && this.manifest['dependencies']) {
    var exports = this.config.exports;
    eachProp(this.manifest['dependencies'], function(url, name) {
      var dep = function(n) {
        var proxy = this.getProxy(n);
        this.postMessage({
          sourceFlow: 'control',
          request: 'dep',
          dep: n
        });
        return proxy;
      }.bind(this, name);
      if (!exports[name]) {
        exports[name] = dep;
      } else {
        dep();
      }
    }.bind(this));
  }
};

fdom.app.Internal.prototype.loadProvides = function() {
  if(this.manifest && this.manifest['provides']) {
    var exp = this.config.exports;
    for (var i = 0; i < this.manifest['provides'].length; i++) {
      var api = fdom.apis.get(this.manifest['provides'][i]);
      if (!api) {
        continue;
      }
      exp[api.name] = function(dfn) {
        var proxy = new fdom.Proxy(this.getChannel(), dfn, true);
        return proxy;
      }.bind(this, api.definition);
    }
  }
}
var fdom = fdom || {};

fdom.Channel = function(app, flow) {
  this.app = app;  // The app (internal or external)
  this.flow = flow;
  handleEvents(this);
};

/**
 * Handle a message from across the channel.
 */
fdom.Channel.prototype.onMessage = function(e) {
  this['emit']('message', e['type'] ? e : e.data);
};

/**
 * Post a message to this channel.
 */
fdom.Channel.prototype.postMessage = function(m) {
  this.app.postMessage({
    sourceFlow: this.flow,
    msg: m
  });
};

/**
 * Create an opaque object which acts like this channel
 * for the purpose of receiving message events, but which
 * can not be introspected to see the flow or app backing
 * the channel.
 */
fdom.Channel.prototype.getProxy = function() {
  var self = this;
  var out = {};
  handleEvents(out);
  out['on']('message', function(msg) {
    self['emit']('message', msg);
  });
  return out;
}

/**
 * Create a pair of channels which relay messages to each other.
 */
fdom.Channel.pipe = function() {
  var first = {};
  var second = {};
  handleEvents(first);
  handleEvents(second);
  first.postMessage = function(msg) {
    second['emit']('message', msg);
  }
  second.postMessage = function(msg) {
    first['emit']('message', msg);
  }
  return [first, second];
}
// TODO: This should make use of ECMA6 Proxies once they are standardized.
// see: https://code.google.com/p/v8/issues/detail?id=1543
var fdom = fdom || {};

/**
 * A fdomProxy or subclass are the exposed interface for freedom applications
 * and providers.  The interface is determined by the constructor arguments.
 * Three types of proxies are currently used:
 * A generic messageChannel, which allows for events ('emit', 'on'), and properties ('set', 'get').
 * A templatedProxy, which appears as a pre-defined definition.
 * A templatedDelegator, which delegates calls to a provider implementing a pre-defined definition.
 * @param {fdom.Channel} channel the Channel backing this interface.
 * @param {Object?} definition An API definition if one is specified.
 * @param {boolean} provider Whether this interface provides or consumes a service.
 * @constructor
 */
fdom.Proxy = function(channel, definition, provider) {
  var proxy;

  // TODO(willscott): remove collision potential
  var hash = channel.flow + Math.random();

  if (definition) {
    if (provider) {
      proxy = new fdom.Proxy.templatedDelegator(channel, definition);
    } else {
      proxy = new fdom.Proxy.templatedProxy(channel, definition, {hash: hash});
    }
  } else {
    proxy = new fdom.Proxy.messageChannel(channel, hash);
  }
  Object.defineProperty(proxy, '__identifier', {
    __proto__: null,
    value: hash
  });
  return proxy;
};


/**
 * A registry of created proxies, used for resolving proxies back
 * to identifiers in order to resolve channels within the freedom core.
 */
fdom.Proxy.registry = {};

/**
 * Get an identifier for a proxy, in order to transfer the capability
 * to access that channel across application boundaries
 * @param {fdom.Proxy} proxy The proxy to identify
 * @returns {Array.<String>} A transferable identifier for the proxy.
 */
fdom.Proxy.getIdentifier = function(proxy) {
  if (fdom.Proxy.registry[proxy['__identifier']]) {
    var info = fdom.Proxy.registry[proxy['__identifier']];
    return [info[0].app.id, info[1], info[2]];
  } else {
    return undefined;
  }
};

/**
 * Reconstitute a proxy from a channel and Identifier.
 * @param {fdom.Channel} channel The channel backing the proxy interface.
 * @param {Object} definition The API definition if the channel is a provider.
 * @param {Array.<String>} identifier The identifier for the channel.
 */
fdom.Proxy.get = function(channel, definition, identifier) {
  if (definition) {
    return new fdom.Proxy.templatedProxy(channel, definition, {flowId: identifier[2]});
  } else {
    return new fdom.Proxy.messageChannel(channel)
  }
}

/**
 * A freedom endpoint for an unconstrained, unpriveledged channel.
 * @param {fdom.Channel} channel The Channel backing this interface.
 * @constructor
 */
fdom.Proxy.messageChannel = function(channel, hash) {
  handleEvents(this);
  if (hash) {
    fdom.Proxy.registry[hash] = [channel, channel.flow];
  }
  var emitter = this['emit'];
  var values = {};

  Object.defineProperty(this, 'reflectEvents', {
    __proto__: null,
    value: true,
    writable: true
  });

  /**
   * Update emission of events to cross the underlying channel.
   * @param {String} type The type of message to send.
   * @param {Object} data The message to send.
   */
  this['emit'] = function(type, data) {
    channel.postMessage({
      'action': 'event',
      'type': type,
      'data': data
    });
    
    if (this['reflectEvents']) {
      emitter(type, data);
    }
  };

  /**
   * Get a property from this object.
   * @param {String} key the property to get.
   */
  this.get = function(key) {
    if (values.hasOwnProperty(key)) {
      return values[key];
    } else {
      return undefined;
    }
  };

  /**
   * Set a property on this object, and replicate across the channel.
   * @param {String} key the property to set.
   * @param {JSON} value the value for the property.
   */
  this.set = function(key, value) {
    if (values.hasOwnProperty(key) || values[key] === undefined) {
      values[key] = value;
      channel.postMessage({
        'action': 'set',
        'key': key,
        'value': value
      });
    }
  }
  
  /**
   * Handle messages from across the channel.
   */
  channel['on']('message', function(msg) {
    if (!msg) return;
    if (msg['action'] == 'event') {
      emitter(msg['type'], msg['data']);
    } else if (msg['action'] == 'set') {
      values[msg['key']] = msg['value'];
    }
  });  
};
/**
 * Note: this follows the structure of jQuery deferred
 * https://github.com/jquery/jquery/blob/master/src/deferred.js
 */

fdom.Proxy.Callbacks = function(multiple) {
  var memory, fired, firing, firingStart, firingLength, firingIndex;
  var stack = multiple && [];
  var list = [];
  var fire = function(data) {
    memory = data;
    fired = true;
    firingIndex = firingStart || 0;
    firingStart = 0;
    firingLength = list.length;
    firing = true;
    for (; list && firingIndex < firingLength; firingIndex++) {
      list[firingIndex].apply(data[0], data[1]);
    }
    firing = false;
    if (list) {
      if (stack && stack.length) {
        fire(stack.shift());
      } else if (!stack) {
        list = [];
      }
    }
  };
  var self = {
    add: function() {
      if (list) {
        var start = list.length;
        (function add(args) {
          for (var i = 0; i < args.length; i++) {
            if (typeof args[i] === 'function') {
              if (!self.has(args[i])) list.push(args[i]);
            } else if (args[i] && args[i].length && typeof args[i] !== 'string') {
              add(args[i]);
            }
          }
        })(arguments);
        if (firing) {
          firingLength = list.length;
        } else if (memory) {
          firingStart = start;
          fire(memory);
        }
      }
      return this;
    },
    remove: function() {
      if (list) {
        for (var i = 0; i < arguments.length; i++) {
          var idx;
          while ((idx = list.indexOf(arguments[i], idx)) > -1) {
            list.splice(idx, 1);
            if (firing) {
              if (idx <= firingLength) {
                firingLength--;
              }
              if (idx <= firingIndex) {
                firingIndex--;
              }
            }
          }
        }
      }
      return this;
    },
    has: function(fn) {
      return fn ? list.indexOf(fn) > -1 : !!(list && list.length);
    },
    empty: function() {
      list = [];
      return this;
    },
    disable: function() {
      list = stack = memory = undefined;
      return this;
    },
    disabled: function() {
      return !list;
    },
    lock: function() {
      stack = undefined;
      return this;
    },
    locked: function() {
      return !stack;
    },
    fireWith: function(context, args) {
      args = args || [];
      args = [context, args.slice ? args.slice() : args];
      if (list && (!fired || stack)) {
        if (firing) {
          stack.push(args);
        } else {
          fire(args);
        }
      }
      return this;
    },
    fire: function() {
      self.fireWith(this, arguments);
      return this;
    },
    fired: function() {
      return !!fired;
    }
  };
  return self;
}

fdom.Proxy.Deferred = function(func) {
  var events = [
    ["resolve", "done", fdom.Proxy.Callbacks(), "resolved"],
    ["reject", "fail", fdom.Proxy.Callbacks(), "rejected"],
    ["notify", "progress", fdom.Proxy.Callbacks(true)]
  ];

  var state = "pending";
  var promise = {
    'state': function() {
      return state;
    },
    'always': function() {
      deferred.done(arguments).fail(arguments);
      return this;
    },
    'then': function() {
      var fns = arguments;
      return fdom.Proxy.Deferred(function(newDefer) {
        for (var i = 0; i < events.length; i++) {
          var action = events[i][0];
          var fn = typeof fns[i] === 'function' ? fns[i] : null;
          deferred[events[i][1]](function() {
            var returned = fn && fn.apply(this, arguments);
            if (returned && typeof returned['promise'] == 'function') {
              returned['promise']()
                .done(newDefer.resolve)
                .fail(newDefer.reject)
                .progress(newDefer.notify)
            } else {
              newDefer[action + "With"](this === promise ? newDefer['promise'](): this, fn ? [returned] : arguments);
            }
          });
        }
        fns = null;
      })['promise']();
    },
    'promise': function(obj) {
      return obj != null ? mixin(obj, promise) : promise;
    }
  };
  var deferred = {};

  // Add event handlers.
  for (var i = 0; i < events.length; i++) {
    var stateStr = events[i][3];
    var list = events[i][2];

    promise[events[i][1]] = list.add;

    if (stateStr) {
      list.add(function() {
        state = stateStr;
      }, events[i ^ 1][2].disable, events[2][2].lock)
    }

    var e = events[i][0];    
    deferred[e] = function(ev) {
      deferred[ev + "With"](this === deferred ? promise : this, Array.prototype.slice.call(arguments, 1));
      return this;
    }.bind(this, e);
    deferred[e + "With"] = list.fireWith;
  }

  promise['promise'](deferred);
  if (func) {
    func.call(deferred, deferred);
  }
  return deferred;
}
fdom.Proxy.templatedDelegator = function(channel, definition) {
  var provider = null;
  var instances = {};
  var synchronous = true;

  var events = {};
  eachProp(definition, function(prop, name) {
    if (prop['type'] == 'event') {
      events[name] = prop;
    }
  });

  this['provideSynchronous'] = function(pro) {
    provider = pro;
  }

  this['provideAsynchronous'] = function(pro) {
    provider = pro;
    synchronous = false;
  }
  
  //TODO(willscott): Allow provider instances to be sent via proxied methods.
  //To do so, generate hashes and put instances in the fdom.Proxy.registry.
  var buildInstance = function(channel, events, identifier) {
    var instance = new provider();
    instance['dispatchEvent'] = function(id, name, value) {
      if (events[name]) {
        channel.postMessage({
          'action': 'event',
          flowId: id,
          'type': name,
          'value': conform(events[name].value, value)
        })
      }
    }.bind({}, identifier);
    return instance;
  }.bind({}, channel, events);

  channel['on']('message', function(msg) {
    if (!msg) return;
    if (!instances[msg.flowId]) {
      if (msg.action == 'construct') {
        instances[msg.flowId] = buildInstance(msg.flowId);
      }
      return;
    }

    if (msg.action == 'method') {
      var instance = instances[msg.flowId];
      if (!instance[msg.type]) {
        console.log("Provider does not implement " + msg.type + "()!");
        return;
      }
      if (synchronous) {
        var ret = instance[msg.type].apply(instance, msg.value);
        channel.postMessage({
          'action': 'method',
          flowId: msg.flowId,
          reqId: msg.reqId,
          'type': msg.type,
          'value': ret
        });
      } else {
        var args = msg.value;
        if (!Array.isArray(args)) {
          args = [args];
        }
        instance[msg.type].apply(instance, args.concat(function(ret) {
          channel.postMessage({
            'action': 'method',
            'type': msg.type,
            flowId: msg.flowId,
            reqId: msg.reqId,
            'value': ret
          });
        }));
      }
    }
  });
};

fdom.Proxy.templatedProxy = function(channel, definition, identifier) {
  var inflight = {};
  var events = null;
  var emitter = null;
  var self = this;
  var flowId;
  if (identifier.flowId) {
    flowId = identifier.flowId
  } else {
    flowId = Math.random();
  }
  if (identifier.hash) {
    fdom.Proxy.registry[identifier.hash] = [channel, channel.flow, flowId];
  }
  var reqId = 0;

  eachProp(definition, function(prop, name) {
    switch(prop['type']) {
      case "property":
        //TODO(willscott): how should asynchronous properties work?
        break;
      case "method":
        this[name] = function() {
          // Note: inflight should be registered before message is passed
          // in order to prepare for synchronous in-window pipes.
          var deferred = fdom.Proxy.Deferred();
          inflight[reqId] = deferred;
          channel.postMessage({
            'action': 'method',
            'type': name,
            reqId: reqId,
            flowId: flowId,
            'value': conform(prop.value, arguments)
          });
          reqId++;
          return deferred['promise']();
        }
        break;
      case "event":
        if(!events) {
          handleEvents(this);
          emitter = this['emit'];
          delete this['emit'];
          events = {};
        }
        events[name] = prop;
        break
    }
  }.bind(this));

  channel['on']('message', function(msg) {
    if (!msg) return;
    if (msg.flowId != flowId) return;
    if (msg.action == 'method') {
      if (inflight[msg.reqId]) {
        var deferred = inflight[msg.reqId];
        delete inflight[msg.reqId];
        deferred['resolve'](msg.value);
      } else {
        console.log("Dropped response message with id " + msg.reqId);
      }
    } else if (msg.action == 'event') {
      var prop = events[msg.type];
      if (prop) {
        var val = conform(prop.value, msg.value);
        emitter(msg.type, val);
      }
    }
  });
  
  if (!identifier.flowId) {
    channel.postMessage({
      'action': 'construct',
      'type': 'construct',
      flowId: flowId
    });
  }
};

/**
 * Force a collection of values to look like the types and length of an API template.
 */
function conform(template, value) {
  switch(template) {
    case "string":
      return "" + value;
    case "number":
      return 0 + value;
    case "bool":
      return false | value;
    case "object":
      // TODO(willscott): Allow removal if sandboxing enforces this.
      return JSON.parse(JSON.stringify(value));
    case "blob":
      return value instanceof Blob ? value : new Blob([]);
    case "buffer":
      return value instanceof ArrayBuffer ? value : new ArrayBuffer(0);
    case "data":
      // TODO(willscott): should be opaque to non-creator.
      return value;
    case "proxy":
      if (Array.isArray(value)) {
        return value;
      } else {
        return fdom.Proxy.getIdentifier(value);
      }
  }
  if (Array.isArray(template)) {
    var val = [];
    if (template.length == 2 && template[0] == "array") {
      //console.log("template is array, value is " + JSON.stringify(value));
      for (var i = 0; i < value.length; i++) {
        val.push(conform(template[1], value[i]));
      }
    } else {
      for (var i = 0; i < template.length; i++) {
        if (value[i]==null || value[i]) val.push(conform(template[i], value[i]))
        else val.push(undefined);
      }
    }
    return val;
  } else if (typeof template === "object") {
    var val = {};
    eachProp(template, function(prop, name) {
      if (value[name]) {
        val[name] = conform(prop, value[name]);
      };
    });
    return val;
  }
}
/**
 * Core freedom services available to all modules.
 * @constructor
 * @private
 */
var Core_unprivileged = function(pipe, app) {
  if (app) {
    this.app = app;
  } else {
    var base = fdom.Proxy.getIdentifier(global['freedom']);
    for (var id in fdom.Proxy.registry) {
      var proxy = fdom.Proxy.registry[id][0];
      if (proxy.app && proxy.app.id == base[0]) {
        this.app = proxy.app;
        break;
      }
    }
  }
};

Core_unprivileged.prototype.onResponse = function(continuation) {
  this.app['once'](function(type, msg) {
    return type == 'message' && msg.data.sourceFlow == 'control';
  }, function(cb, msg) {
    var id = msg.data.msg.flow;
    var chan = this.app.getProxy(id);
    cb(chan);
  }.bind(this, continuation));
}


Core_unprivileged.prototype.createChannel = function(continuation) {
  this.onResponse(continuation);

  this.app.postMessage({
    sourceFlow: 'control',
    request: 'channel'
  });
};

Core_unprivileged.prototype.bindChannel = function(identifier, continuation) {
  this.onResponse(continuation);

  this.app.postMessage({
    sourceFlow: 'control',
    request: 'channel',
    to: identifier
  });
};

Core_unprivileged.bindChannel = function(identifier) {
  var pipe = fdom.Channel.pipe();
  fdom.Hub.get().bindChannel(identifier[0], identifier[1], pipe[0]);
  //TODO(willscott): this is sketchy :-/
  var app = fdom.Hub.get().apps[identifier[0]];
  var flow = app.getChannel(identifier[1]);
  pipe[0]['on']('message', flow.postMessage.bind(flow));
  return pipe[1];
};

fdom.apis.register("core", Core_unprivileged);
/**
 * A FreeDOM interface to WebRTC Peer Connections
 * @constructor
 * @private
 */
var PeerConnection_unprivileged = function(channel) {
  this.appChannel = channel;
  this.dataChannel = null;
  this.identity = null;
  this.connection = null;
  this.myPid = Math.random();
  this.remotePid = 1;
  handleEvents(this);
};

PeerConnection_unprivileged.prototype.open = function(proxy, continuation) {
  if (this.connection) {
    continuation(false);
  }

  // Listen for messages to/from the provided message channel.
  this.appChannel = Core_unprivileged.bindChannel(proxy);
  this.appChannel['on']('message', this.onIdentity.bind(this));
  this.appChannel.postMessage({
    'type': 'ready',
    'action': 'event'
  });

  this.setup(true);
  continuation();
}

PeerConnection_unprivileged.prototype.setup = function(initiate) {
  var RTCPeerConnection = RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
  this.connection = new RTCPeerConnection(null, {'optional': [{'RtpDataChannels': true}]});

  var dcSetup = function() {
    this.dataChannel.addEventListener('open', function() {
      console.log("Data channel opened.");
      this.emit('open');
    }.bind(this), true);
    this.dataChannel.addEventListener('message', function(m) {
      // TODO(willscott): Support native binary transport, rather than this mess
      if (this.parts > 0) {
        this.buf += m.data;
        this.parts--;
        console.log('waiting for ' + this.parts + ' more parts.')
        if (this.parts == 0) {
          console.log("binary data recieved (" + this.buf.length + " bytes)");
          var data = JSON.parse(this.buf);
          var arr = new Uint8Array(data['binary']);
          var blob = new Blob([arr.buffer], {"type": data['mime']});
          this['dispatchEvent']('message', {"binary": blob});
          this.buf = "";
        }
        return;
      }
      var data = JSON.parse(m.data);
      if (data['text']) {
        this['dispatchEvent']('message', {"text": data['text']});
      } else {
        this.parts = data['binary'];
        console.log("Beginning receipt of binary data (" + this.parts + " parts)");
        this.buf = "";
      }
    }.bind(this), true);
    this.dataChannel.addEventListener('close', function(conn) {
      if (this.connection == conn) {
        this['dispatchEvent']('onClose');
        this.close(function() {});
      }
    }.bind(this, this.connection), true);
  }.bind(this);

  if (initiate) {
    this.dataChannel = this.connection.createDataChannel("sendChannel", {'reliable': false});
    dcSetup();
  } else {
    this.connection.addEventListener('datachannel', function(evt) {
      this.dataChannel = evt['channel'];
      dcSetup();
    }.bind(this));
  }

  this.connection.addEventListener('icecandidate', function(evt) {
    if(evt && evt['candidate']) {
      this.appChannel.postMessage({
        'type': 'message',
        'action': 'event',
        'data': JSON.stringify(evt['candidate'])
      });
    }
  }.bind(this), true);

  this.makeOffer();
}

PeerConnection_unprivileged.prototype.makeOffer = function() {
  if (this.remotePid < this.myPid) {
    return;
  }
  this.connection.createOffer(function(desc) {
    this.connection.setLocalDescription(desc);
    desc['pid'] = this.myPid;
    this.appChannel.postMessage({
      'type': 'message',
      'action': 'event',
      'data': JSON.stringify(desc)
    });
  }.bind(this));
}

PeerConnection_unprivileged.prototype.makeAnswer = function() {
  this.connection.createAnswer(function(desc) {
    this.connection.setLocalDescription(desc);
    desc['pid'] = this.myPid;
    this.appChannel.postMessage({
      'type': 'message',
      'action': 'event',
      'data': JSON.stringify(desc)
    });
  }.bind(this));
}

PeerConnection_unprivileged.prototype.onIdentity = function(msg) {
  try {
    var m = JSON.parse(msg.data);
    if (m['candidate']) {
      var candidate = new RTCIceCandidate(m);
      this.connection.addIceCandidate(candidate);
    } else if (m['type'] == 'offer' && m['pid'] != this.myId) {
      this.remotePid = m['pid'];
      if (this.remotePid < this.myPid) {
        this.close(function() {
          this.setup(false);
          this.connection.setRemoteDescription(new RTCSessionDescription(m), function() {}, function() {
            console.log("Failed to set remote description");
          });
          this.makeAnswer();
        }.bind(this));
      } else {
        // They'll get my offer and send an answer.
      }
    } else if (m['type'] == 'answer' && m['pid'] != this.myId) {
      this.remotePid = m['pid'];
      this.connection.setRemoteDescription(new RTCSessionDescription(m));
    }
  } catch(e) {
    console.log("Couldn't understand identity message: " + JSON.stringify(msg) + ": -> " + e.message);
  }
}

PeerConnection_unprivileged.prototype.postMessage = function(ref, continuation) {
  if (!this.connection) {
    return continuation(false);
  }
  // Queue until open.
  if (!this.dataChannel || this.dataChannel.readyState != "open") {
    return this.once('open', this.postMessage.bind(this, ref, continuation));
  }
  window.dc = this.dataChannel;

  console.log("Sending transport data.");
  if(ref['text']) {
    console.log("Sending text: " + ref['text']);
    this.dataChannel.send(JSON.stringify({"text":ref['text']}));
  } else if(ref['binary']) {
    // TODO(willscott): implement direct blob support when available.
    console.log("Transmitting " + ref['binary'].size + " binary bytes");
    var reader = new FileReader();
    reader.addEventListener('load', function(type, ev) {
      var arr = [];
      arr.push.apply(arr, new Uint8Array(ev.target.result));
      // Chunk messages so that packets are below MTU.
      var MAX_LEN = 512;
      var STEP = 300;
      var str = JSON.stringify({"mime": type, "binary": arr});
      var parts = Math.ceil(str.length / MAX_LEN);
      console.log("Sending chunked " + type + " ("+ str.length + " bytes)");
      this.dataChannel.send(JSON.stringify({"binary": parts}));

      var delay = 0;
      while (str.length > 0) {
        setTimeout(function(x) {
          this.dataChannel.send(x);
        }.bind(this, str.substr(0, MAX_LEN)), delay);
        delay += STEP;
        str = str.substr(MAX_LEN);
      }
    }.bind(this, ref['binary'].type), true);

    reader.readAsArrayBuffer(ref['binary']);
  }
  continuation();
};

PeerConnection_unprivileged.prototype.close = function(continuation) {
  delete this.dataChannel;

  if (this.connection) {
    try {
      this.connection.close();
    } catch(e) {
      // Ignore already-closed errors.
    }
    delete this.connection;
  }
  continuation();
};

fdom.apis.register("core.peerconnection", PeerConnection_unprivileged);
/**
 * A FreeDOM storage provider offers a key value store interface
 * with some level of persistance, and some size limitation.
 * @constructor
 * @private
 */
var Storage_unprivileged = function(channel) {
  this.channel = channel;
  handleEvents(this);
};

Storage_unprivileged.prototype.get = function(key, continuation) {
  try {
    var val = localStorage[this.channel.app.id + key];
    continuation(val);
  } catch(e) {
    continuation(null);
  }
}

Storage_unprivileged.prototype.set = function(key, value, continuation) {
  localStorage[this.channel.app.id + key] = value;
  continuation();
}

fdom.apis.register("core.storage", Storage_unprivileged);/**
 * A FreeDOM view is provided as a core service to providers, allowing them
 * the capability of providing screen realestate.  Implementation is conducted
 * as a sandboxed iFrame at separate origin, whose sendMessage channel is
 * given to the provider.
 * @constructor
 * @private
 */
var View_unprivileged = function(channel) {
  this.host = null;
  this.win = null;
  this.channel = channel;
  handleEvents(this);
};

View_unprivileged.prototype.open = function(args, continuation) {
  this.host = document.createElement("div");
  document.body.appendChild(this.host);
  var root = this.host;
  // TODO(willscott): Support shadow root as available.
  // if (this.host['webkitCreateShadowRoot']) {
  //   root = this.host['webkitCreateShadowRoot']();
  // }
  var frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts allow-forms");
  if (args['file']) {
    var app = this.channel.app;
    frame.src = resolvePath(args['file'], app.id);
  } else if (args['code']) {
    frame.src = "data:text/html;charset=utf-8," + args['code'];
  }
  frame.style.width = "0";
  frame.style.height = "0";
  root.appendChild(frame);
  this.win = frame;
  addEventListener('message', this.onMessage.bind(this), true);
  continuation({});
}

View_unprivileged.prototype.show = function(continuation) {
  if (this.win) {
    // Fullscreen mode.
    this.win.style.position = 'fixed';
    this.win.style.top = '0px';
    this.win.style.left = '0px';
    this.win.style.width = '100%';
    this.win.style.height = '100%';
    this.win.style.background = 'rgba(255,255,255,0.75)';
    this.win.style.border = '0px';
    
    // Refresh Layout
    this.host.style.position = 'absolute';
  }
  continuation();
}

View_unprivileged.prototype.postMessage = function(args, continuation) {
  this.win.contentWindow.postMessage(args, '*');
}

View_unprivileged.prototype.close = function() {
  if (this.host) {
    this.host.parentNode.removeChild(this.host);
    this.host = null;
  }
  if (this.win) {
    removeEventListener('message', this.onMessage.bind(this), true);
    this.win = null;
  }
}

View_unprivileged.prototype.onMessage = function(m) {
  if (m.source == this.win.contentWindow) {
    this['dispatchEvent']('message', m.data);
  }
}

fdom.apis.register("core.view", View_unprivileged);
// This structure is meant to resemble that of require.js
/*jslint sloppy:true */
/*global window, document, setTimeout, XMLHttpRequest */

/**
 * Main entry point.
 */
setup = function () {
  var def;
  var site_cfg = {
    global: global,
    'debug': true,
    src: "(" + freedom_src + ")(this);"
  };

  if (isAppContext()) {
    def = new fdom.app.Internal();
  } else {
    advertise();
    def = new fdom.app.External();    

    // Configure against data-manifest.
    if (typeof document !== 'undefined') {
      eachReverse(scripts(), function (script) {
        var manifest = script.getAttribute('data-manifest');
        var source = script.src;
        if (manifest) {
          site_cfg.source = source;
          site_cfg.manifest = manifest;
          if (script.textContent.trim().length) {
            try {
              mixin(site_cfg, JSON.parse(script.innerText), true);
            } catch (e) {
              global.console.warn("Failed to parse configuration: " + e);
            }
          }
          return true;
        }
      });
    }
  }
  def.configure(site_cfg);

  // Enable console.log from worker contexts.
  if (typeof global.console === 'undefined') {
    global.console = {
      log: def.debug.bind(def)
    };
  }

  return def.getProxy();
};

fdom.apis.set("core", {
  'createChannel': {type: "method", value: []},
  'bindChannel': {type: "method", value: ["proxy"]}
});

fdom.apis.set("core.view", {
  'open': {type: "method", value: [{
    'file':"string",
    'code':"string"
  }]},
  'show': {type: "method", value: []},
  'close': {type: "method", value: []},
  'postMessage': {type: "method", value: ["object"]},

  'message': {type: "event", value: "object"},
  'onClose': {type: "event", value: []}
});

fdom.apis.set("core.storage", {
  'set': {type: "method", value: ["string", "string"]},
  'get': {type: "method", value: ["string"]},
  'change': {type: "event", value: ["string"]}
});

fdom.apis.set("core.peerconnection", {
  'open': {type: "method", value: ["proxy"]},
  'postMessage': {type: "method", value: [{"text": "string", "binary": "blob"}]},
  'message': {type: "event", value: {"text": "string", "binary": "blob"}},

  'close': {type: "method", value: []},
  'onClose': {type: "event", value: []}
});

fdom.apis.set("core.socket", {
  'create': {type: "method", value: ["string", "object"]},
  'connect': {type: "method", value: ["number", "string", "number"]},
  'read': {type: "method", value: ["number"]},
  'write': {type: "method", value: ["number", "buffer"]},
  'disconnect': {type: "method", value: ["number"]},
  'destroy': {type: "method", value: ["number"]}
});
fdom.apis.set("identity", {
  //Stores the 'ID' for logged in user (alice@gmail.com)
  //e.g. var id = identity.id
  'id': {type: "property", value: "string"},
  //Gets the profile of a user
  //If id is null, return self
  //e.g. identity.getProfile(String id);
  //Returns {
  //  'card': {
  //    'id': 'string',       //ID (e.g. alice@gmail.com) username
  //    'name': 'string',     //Name (e.g. Alice Underpants)
  //    'imageUrl': 'string', //URL to profile pic
  //    'status': 'string'    //Status (['messageable', 'online', 'offline'])
  //  }
  //  'roster': {             //List of friends
  //    'id1': {              //NOTE: Key must match 'id' in card
  //      'id1': 'string',
  //      'name': 'string',
  //      'imageUrl': 'string',
  //      'status': 'string'
  //    },
  //    'id2': ...
  //  }
  //}
  'getProfile': {type: "method", value: ["string"]},
  //Send a message to user on your network
  //e.g. sendMessage(String destination_id, String message)
  //Returns nothing
  'sendMessage': {type: "method", value: ["string", "string"]},
  //Event on change in profile
  //(includes changes to roster)
  'onChange': {type: "event", value: {
    'id': 'string',
    'name': 'string',
    'imageUrl': 'string',
    'status': 'string'
  }},
  //Event on incoming message
  'onMessage': {type: "event", value: {
    "from": "string",   //id of user message is from
    "message": "object" //message contents
  }}
});

fdom.apis.set("storage", {
  //Removes all data from storage
  //e.g. storage.clear();
  //Returns nothing
  'clear': {type: "method", value: []},
  //Sets a value to a key
  //e.g. set(String key, String value)
  //Returns nothing
  'set': {type: "method", value: ["string", "string"]},
  //Removes a single key
  //e.g. remove(String key)
  //Returns nothing
  'remove': {type: "method", value: ["string"]},
  //Returns a value for a key, null if doesn't exist
  //e.g. get(String key)
  //Returns a string with the value
  'get': {type: "method", value: ["string"]}
});
fdom.apis.set("core.transport", {
  'create': {type: "method", value: []},
  'accept': {type: "method", value: ["number", "object"]},
  'send': {type: "method", value: [{
    "header": "object",
    "data": "blob"
  }]},
  'close': {type: "method", value: ["number"]},
  
  'onStateChange': {type: "event", value: "object"},
  'onMessage': {type: "event", value: {
    "header": "object",
    "data": "blob"
  }},
  'onSignal': {type: "event", value: "object"}
});

fdom.apis.set("transport", {
  'open': {type: "method", value: ["proxy"]},
  'send': {type: "method", value: ["data"]},
  'message': {type: "event", value: "data"},
  'close': {type: "method", value: []},
  'onClose': {type: "event", value: []}
});
  // Create default context.
  global['freedom'] = setup();
})(this);

