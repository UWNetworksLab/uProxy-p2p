/*
 * Configuration and control of the browsers proxy settings.
 */

/// <reference path='../../../interfaces/lib/chrome/chrome.d.ts'/>


class BrowserProxyConfig {
  private preUproxyConfig_ :chrome.proxy.ProxyConfig = null;
  private uproxyConfig_ :chrome.proxy.ProxyConfig = null;
  private running_ :boolean = false;

  constructor() {
    // use localhost
    this.uproxyConfig_ = {
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
  }

  clearConfig = () => {
    chrome.proxy.settings.clear({scope: 'regular'});
  };

  startUsingProxy = () => {
    if (this.running_ == false) {
      console.log('Directing Chrome proxy settings to UProxy');
      this.running_ = true;
      chrome.proxy.settings.get({incognito:false},
        (details) => {
          this.preUproxyConfig_ = details.value;
          chrome.proxy.settings.set({
              value: this.uproxyConfig_,
              scope: 'regular'
            }, () => {console.log('Successfully set proxy');});
        });
    }
  };

  stopUsingProxy = () => {
    if (this.running_ == true) {
      console.log('Reverting Chrome proxy settings');
      this.running_ = false;
      chrome.proxy.settings.set({
        value: this.preUproxyConfig_,
        scope: 'regular'
      });
    }
  };

};  // end of this.socialNetworkName BrowserProxyConfig
