/// <reference path='../../../generic_ui/scripts/core_connector.ts'/>
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>
/// <reference path='../../../uproxy.ts' />

declare var core :CoreConnector;
declare var model :UI.Model;

// TODO: write a similar class for Firefox that will implement a common
// interface as Chrome

// Abstract base class for chrome tab based authentication
// Sub-classes are expected to set:
// - getOauthUrl(redirectUrl): returns the Oauth URL
// - extractCode(url): returns a promise that fulfills with credentials on
//   success.
class ChromeTabAuth {

  // last OAuth reponse URL.
  private lastOAuthURL_ :string;

  constructor() {
  }

  public login = (oauthInfo :OAuthInfo) : void => {
    if (model.reconnecting && this.lastOAuthURL_) {
      this.sendCredentials_(this.lastOAuthURL_);
    } else {
      this.launchAuthTab_(oauthInfo.url, oauthInfo.redirect);
    }
  }


  private launchAuthTab_ = (url :string, redirectUrl :string) : void => {
    var onTabChange = (tabId, changeInfo, tab) => {
      if (tab.url.indexOf(redirectUrl) === 0) {
        chrome.tabs.onUpdated.removeListener(onTabChange);
        chrome.tabs.remove(tabId);
        this.lastOAuthURL_ = tab.url;
        this.sendCredentials_(tab.url);
      }
    };

    chrome.tabs.create({url: url},
                       function(tab: chrome.tabs.Tab) {
      chrome.windows.update(tab.windowId, {focused: true});
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
