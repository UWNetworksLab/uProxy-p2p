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

  constructor() {
  }

  public login = () : void => {
    this.launchAuthTab_();
  }

  public getOauthUrl = (redirctUrl) : string => {
    throw new Error('Operation not implemented');
  }

  public extractCode = (url) : Promise<any> => {
    throw new Error('Operation not implemented');
  }

  public onTabChange = (tabId, changeInfo, tab) => {
    if (tab.url.indexOf(REDIRECT_URL) === 0) {
      chrome.tabs.onUpdated.removeListener(this.onTabChange);
      chrome.tabs.remove(tabId);
      this.extractCode(tab.url).then((credentials :any) => {
        this.sendCredentials_(credentials);
      }).catch((e) => {
        this.onError_(e.toString());
      });
    }
  };

  private launchAuthTab_ = () : void => {
    chrome.tabs.create({url: this.getOauthUrl(REDIRECT_URL)},
                        function(tab: chrome.tabs.Tab) {
      chrome.tabs.onUpdated.addListener(this.onTabChange);
    }.bind(this));
  }

  private onError_ = (errorText :string) : void => {
    core.sendCommand(uProxy.Command.SEND_CREDENTIALS,
                     {cmd: 'error', message: errorText});
  }

  private sendCredentials_ = (credentials :GoogleTalkCredentials) : void => {
    core.sendCommand(uProxy.Command.SEND_CREDENTIALS,
                     {cmd: 'auth', message: credentials});
  }
}
