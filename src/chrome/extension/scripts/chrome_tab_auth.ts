/// <reference path='../../../generic_ui/scripts/core_connector.ts'/>
/// <reference path='../../../interfaces/authentication-manager.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>
/// <reference path='../../../uproxy.ts' />

var REDIRECT_URL = "https://www.uproxy.org/oauth-redirect-uri";

declare var core :CoreConnector;

// TODO: write a similar class for Firefox that will implement a common
// interface as Chrome

// Abstract base class for chrome tab based authentication
// Sub-classes are expected to set:
// - getOauthUrl(redirectUrl): returns the Oauth URL
// - extractCode(url): returns a promise that fulfills with credentials on
//   success.
class ChromeTabAuth {
  private tabId_ :number = -1;

  constructor() {
  }

  public login = (url :string) : void => {
    if (this.tabId_ === -1) {
      this.launchAuthTab_(url);
    } else {
      chrome.tabs.update(this.tabId_, {active:true});
    }
  }


  private launchAuthTab_ = (url :string) : void => {
    var onTabChange = (tabId, changeInfo, tab) => {
      if (tab.id === this.tabId_ && tab.url.indexOf(REDIRECT_URL) === 0) {
        chrome.tabs.onUpdated.removeListener(onTabChange);
        chrome.tabs.onRemoved.removeListener(onTabClose);
        this.tabId_ = -1;
        chrome.tabs.remove(tabId);
        this.sendCredentials_(tab.url);
      }
    };

    // Cleanup state and return error if the tab is closed before the tab
    // is redirected to REDIRECT_URL
    var onTabClose = function(tabId, removeInfo) {
        if (tabId == this.tabId_) {
          chrome.tabs.onUpdated.removeListener(onTabChange);
          chrome.tabs.onRemoved.removeListener(onTabClose);
          this.tabId_ = -1;
          this.onError_('Login abandoned.');
        }
    }.bind(this);


    chrome.tabs.create({url: url},
                       function(tab: chrome.tabs.Tab) {
      this.tabId_ = tab.id;
      chrome.tabs.onRemoved.addListener(onTabClose);
      chrome.tabs.onUpdated.addListener(onTabChange);
    }.bind(this));
  }

  private onError_ = (errorText :string) : void => {
    core.sendCommand(uProxy.Command.SEND_CREDENTIALS, errorText);
  }

  private sendCredentials_ = (url :string) : void => {
    core.sendCommand(uProxy.Command.SEND_CREDENTIALS, url);
  }
}
