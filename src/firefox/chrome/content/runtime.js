if (typeof org === 'undefined') var org = {};
if (!org.freedomos) org.freedomos = {};

(function setupSocketProvider(scope) {

  /**
   * A provider for the freedom.js runtime.
   * Implements the core.runtime functionality for migration of modules from
   * remote contexts into or through this hub.
   * @constructor
   * @private
   */
  var Runtime_firefox = function(app) {
    console.log('constructing Runtime_firefox');
    this.app = app;
    this.outstandingWork = {};

    this.app.emit(this.app.controlChannel, {
      type: 'Resource Resolver',
      request: 'resource',
      service: 'runtime',
      args: [this.runtimeResolver.bind(this), this.runtimeRetriever.bind(this)]
    });
  };

  Runtime_firefox.prototype.createApp = function(manifest, proxy, contination) {
    console.log('creating app');
    this.app.emit(this.app.controlChannel, {
      type: 'RuntimeApp',
      request: 'bindapp',
      to: proxy[0],
      port: proxy[1],
      id: manifest
    });
  };

  //Resolve chrome://<url> urls.
  Runtime_firefox.prototype.runtimeResolver = function(manifest, url, deferred) {
    console.log('resolving resource url');
    var resource, mbase;

    if (manifest.indexOf("chrome://") === 0) {
      resource = manifest.substr(10).split('#');
      mbase = resource[1];
      this.app.config.resources.get(mbase, url).done(function(deferred, url) {
        deferred.resolve(url);
      }.bind(this, deferred));
      return true;
    }
    return false;
  };

  //Retreive runtime://<manifest>#<resource> addresses.
  Runtime_firefox.prototype.runtimeRetriever = function(url, deferred) {
    console.log('retrieving runtime');
    var resource, req;

    resource = url.substr(10).split('#');
    req = resource[1];
    this.outstandingWork[req] = deferred;
    this.dispatchEvent('needFile', [resource[0], req]);
  };

  Runtime_firefox.prototype.resolve = function(file, data, continuation) {
    console.log('resolve called');
    if (this.outstandingWork[file]) {
      this.outstandingWork[file].resolve(data);
      delete this.outstandingWork[file];
    }
    continuation();
  };
})(org.freedomos);
