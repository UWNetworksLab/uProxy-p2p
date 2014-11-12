/**
 * chrome_browser_api.ts
 *
 * Chrome-specific implementation of the Browser API.
 */
/// <reference path='../../../interfaces/browser-api.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>
/// <reference path='../../../networking-typings/communications.d.ts' />


class ChromeBrowserApi implements BrowserAPI {

  // For browser action.

  public ICON_DIR :string = 'icons/';

  public setIcon = (iconFile :string) : void => {
    chrome.browserAction.setIcon({
      path: this.ICON_DIR + iconFile
    });
  }

  // For proxy configuration.

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
    // Get the active tab. If it's not the disconnected error page, we
    // might need to bring up that page.
    chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
      var thisUrl = tabs[0].url;
      var disconnectUrl = chrome.extension.getURL("polymer/disconnected.html");

      if (askUser && this.running_ == true && (thisUrl != disconnectUrl)) {
        // If the browser is currently proxying, if the open tab is not the
        // disconnect error page, and if we want to let the user confirm if
        // they want to revert their proxy settings, then
        // create a tab which prompts the user to decide if they want
        // to reset their proxy config.
        chrome.tabs.create({url: "../polymer/disconnected.html"},
                         function(tab: chrome.tabs.Tab) {
            this.tabId_ = tab.id;
          }.bind(this));
      } else if (!askUser && this.running_ == true) {
        this.revertProxySettings_();
      }
    }.bind(this));

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

  // For FAQ.

  public openFaq = (pageAnchor :string) => {
    chrome.tabs.create({url: "../polymer/faq.html#" + pageAnchor});
  }
}
