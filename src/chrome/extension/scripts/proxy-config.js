/*
 * Configuration and control of the browsers proxy settings.
 */

(function(exports) {
  // From:
  //   http://en.wikipedia.org/wiki/Private_network
  //   http://en.wikipedia.org/wiki/Reserved_IP_addresses
  var auto_conf_addresses = ["169.254.0.0/16", "fe80::/10"];
  var local_network_addresses = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"];
  var other_non_routable = ["0.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "192.0.0.0/29", "192.0.2.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "2001:10::/28", "2001:db8::/32"]

  function BrowserProxyConfig() {
    // Save initial settings.
    // Check: do we need to do this? will clear work?
    this.preUproxyConfig = null;

    // use localhost
    this.uproxyConfig = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "socks5",
          host: "127.0.0.1",
          port: 9999
        },
        // List of domains to bypass the proxy
        // Bypass Google/Facebook RESTful API endpoint (used by XMPP for auth)
        bypassList: ["<local>", "www.googleapis.com", "graph.facebook.com",
                     "computeengineondemand.appspot.com"]
      }
    };

    this.currentConfig = {};
    this.running = false;
  }

  BrowserProxyConfig.prototype.clearConfig = function () {
    chrome.proxy.settings.clear({scope: 'regular'}, function() {});
  };

  BrowserProxyConfig.prototype.startUsingProxy = function () {
    if (this.running == false) {
      console.log('Directing Chrome proxy settings to UProxy');
      this.running = true;
      chrome.proxy.settings.get({
        incognito:false
      }, (function(details) {
        this.preUproxyConfig = details.value; 
        this.currentConfig = chrome.proxy.settings.set({
          value: this.uproxyConfig, 
          scope: 'regular'
        }, (function() {console.log('Successfully set');}).bind(this));
      }).bind(this));
    }
  };

  BrowserProxyConfig.prototype.stopUsingProxy = function () {
    if (this.running == true) {
      console.log('Reverting Chrome proxy settings');
      this.running = false;
      chrome.proxy.settings.set({
        value: this.preUproxyConfig, 
        scope: 'regular'
      },(function() {
        this.currentConfig = {};
      }).bind(this));
    }
  };

  exports.BrowserProxyConfig = BrowserProxyConfig;
})(window);
