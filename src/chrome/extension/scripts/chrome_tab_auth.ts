/// <reference path='../../../../../third_party/typings/chrome/chrome.d.ts'/>

import core_connector = require('../../../generic_ui/scripts/core_connector');
import uproxy_core_api = require('../../../interfaces/uproxy_core_api');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import user_interface = require('../../../generic_ui/scripts/ui');
import chromeInterface = require('../../../interfaces/chrome');
import background = require('./background');

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

  public login = (oauthInfo :chromeInterface.OAuthInfo) : void => {
    this.launchAuthTab_(oauthInfo.url, oauthInfo.redirect);
  }


  private launchAuthTab_ = (url :string, redirectUrl :string) : void => {
    var onTabChange = (tabId :number, changeInfo :chrome.tabs.TabChangeInfo, tab :chrome.tabs.Tab) => {
      if (tab.url.indexOf(redirectUrl) === 0) {
        chrome.tabs.onUpdated.removeListener(onTabChange);
        chrome.tabs.remove(tabId);
        this.sendCredentials_(tab.url);
      }
    };

    var isActive = true; //TODO use actual value
    chrome.tabs.create({url: url, active: isActive},
                       function(tab: chrome.tabs.Tab) {
      if (isActive) {
        chrome.windows.update(tab.windowId, {focused: true});
      }
      chrome.tabs.onUpdated.addListener(onTabChange);
    }.bind(this));
  }

  private onError_ = (errorText :string) : void => {
    background.core.sendCommand(uproxy_core_api.Command.SEND_CREDENTIALS, errorText);
  }

  private sendCredentials_ = (url :string) : void => {
    background.core.sendCommand(uproxy_core_api.Command.SEND_CREDENTIALS, url);
  }
}

export = ChromeTabAuth;
