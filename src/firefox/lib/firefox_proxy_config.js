/**
 * Firefox proxy settings implementation
 * TODO(salomegeo): rewrite it in typescript
 */

var { Cc, Ci } = require("chrome");
var prefsvc = require("sdk/preferences/service");

var running = false;

var pps = Cc['@mozilla.org/network/protocol-proxy-service;1']
            .getService(Ci.nsIProtocolProxyService);

var proxyinfo = null;

var filter = {
  applyFilter: function(aProxyService, aURI, aProxy) {
    if (!proxyinfo) {
      // something went wrong.  For now, just fail by doing nothing.
      return aProxy;
    }

    return proxyinfo;
  }
}

var flags = Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST;

var proxyConfig = {
  startUsingProxy: function(endpoint) {
    running = true;
    proxyinfo = pps.newProxyInfo('socks', endpoint.address, endpoint.port, flags, 0, null);
    pps.registerFilter(filter, 0);
  },
  stopUsingProxy: function() {
    if (running) {
      running = false;
      pps.unregisterFilter(filter);
      proxyinfo = null;
    }
  }
};

exports.proxyConfig = proxyConfig
