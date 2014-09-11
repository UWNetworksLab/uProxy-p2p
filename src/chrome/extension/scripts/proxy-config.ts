/*
 * Configuration and control of the browsers proxy settings.
 */

/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>
/// <reference path='../../../interfaces/browser-proxy-config.d.ts'/>


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
          host: "127.0.0.1",
          port: 9999
        }
      }
    };

    // TODO: tsd's chrome definition is missing .clear on ChromeSetting, which
    // is why we employ a hacky thing here.
    chrome.proxy.settings['clear']({scope: 'regular'});
  }

  public startUsingProxy = () => {
    if (this.running_ == false) {
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

  public stopUsingProxy = () => {
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
