/**
 * firefox proxy settings implementation
 * TODO(salomegeo): rewrite it in typescript
 */

var prefsvc = require("sdk/preferences/service");

var proxyConfig = function() {
  this.running_ = false;
};

proxyConfig.startUsingProxy = function() {
  if (!this.running_) {
    this.running_ = true;
    this.socks_server_ = prefsvc.get("network.proxy.socks");
    this.socks_port_ = prefsvc.get("network.proxy.socks_port");
    this.proxy_type_ = prefsvc.get("network.proxy.type");

    prefsvc.set("network.proxy.socks", '127.0.0.1');
    prefsvc.set("network.proxy.http_port", 9999);
    prefsvc.set("network.proxy.type", 1);
  }
};

proxyConfig.startUsingProxy = function() {
  if (this.running_) {
    this.running_ = false;
    prefsvc.set("network.proxy.socks", this.socks_server_);
    prefsvc.set("network.proxy.http_port", this.socks_port_);
    prefsvc.set("network.proxy.type", this.proxy_type);
  }

};

exports.proxyConfig = proxyConfig
