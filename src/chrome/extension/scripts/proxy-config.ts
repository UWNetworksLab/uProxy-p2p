/*
 * Configuration and control of the browsers proxy settings.
 */

/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>
/// <reference path='../../../interfaces/browser-proxy-config.d.ts'/>
/// <reference path='../../../networking-typings/communications.d.ts' />

class BrowserProxyConfig implements IBrowserProxyConfig {
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
          host: null,
          port: null
        }
      }
    };

    // TODO: tsd's chrome definition is missing .clear on ChromeSetting, which
    // is why we employ a hacky thing here.
    chrome.proxy.settings['clear']({scope: 'regular'});
  }

  public startUsingProxy = (endpoint:Net.Endpoint) => {
    if (this.running_ == false) {
      this.uproxyConfig_.rules.singleProxy.host = endpoint.address;
      this.uproxyConfig_.rules.singleProxy.port = endpoint.port;
      console.log('Directing Chrome proxy settings to uProxy');
      this.running_ = true;
      chrome.proxy['settings']['get']({incognito:false},
        (details) => {
          this.preUproxyConfig_ = details.value;
          chrome.proxy.settings.set({
              value: this.uproxyConfig_,
              scope: 'regular'
            }, () => {console.log('Successfully set proxy');});
        });
    }
  };

  public stopUsingProxy = (askUser :boolean) => {
    if (askUser && this.running_ == true) {
      // Create a tab which prompts the user to decide if they want
      // to reset their proxy config.
      chrome.tabs.create({url: "../polymer/disconnected.html"});
    } else {
      this.revertProxySettings_();
    }
  };

  private revertProxySettings_ = () => {
    if (this.running_ == true) {
      console.log('Reverting Chrome proxy settings');
      this.running_ = false;
      chrome.proxy.settings.set({
        value: this.preUproxyConfig_,
        scope: 'regular'
      });
    }
  };
}  // BrowserProxyConfig
