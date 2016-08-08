/// <reference path='../../../../../third_party/typings/index.d.ts'/>

import core_connector = require('../../../generic_ui/scripts/core_connector');
import uproxy_core_api = require('../../../interfaces/uproxy_core_api');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
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
    this.launchAuthTab_(
        oauthInfo.url, oauthInfo.redirect, oauthInfo.interactive);
  }


  private launchAuthTab_ = (url :string, redirectUrl :string, interactive :boolean) : void => {
    var gotCredentials = false;
    var onTabChange = (tabId :number, changeInfo :chrome.tabs.TabChangeInfo, tab :chrome.tabs.Tab) => {
      if (tab.url.indexOf(redirectUrl) === 0) {
        chrome.tabs.onUpdated.removeListener(onTabChange);
        chrome.tabs.remove(tabId);
        gotCredentials = true;
        this.sendCredentials_(tab.url);
      }
    };

    chrome.tabs.create({url: url, active: interactive},
                       function(tab: chrome.tabs.Tab) {
      if (interactive) {
        chrome.windows.update(tab.windowId, {focused: true});
      } else {
        // For non-interactive login, close tab and reject if we don't have
        // credentials within 5 seconds.
        setTimeout(() => {
          if (!gotCredentials) {
            chrome.tabs.remove(tab.id);
            this.onError_('Error reconnecting');
          }
        }, 5000);
      }
      chrome.tabs.onUpdated.addListener(onTabChange);
    }.bind(this));
  }

  private onError_ = (errorText :string) : void => {
    background.core.sendCommand(
        uproxy_core_api.Command.CREDENTIALS_ERROR, errorText);
  }

  private sendCredentials_ = (url :string) : void => {
    background.core.sendCommand(
        uproxy_core_api.Command.SEND_CREDENTIALS, url);
  }
}

export = ChromeTabAuth;
