/// <reference path='../../../generic_ui/scripts/core_connector.ts'/>
/// <reference path='../../../interfaces/authentication-manager.d.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome.d.ts'/>
/// <reference path='../../../uproxy.ts' />

var CLIENT_ID =
    "746567772449-bp2g60f0mq4g8u02pqcepm2mjttogrrt.apps.googleusercontent.com";
var CLIENT_SECRET = "Bmlc90_i2GFcaP26Fneq9UnO";

var REDIRECT_URI = "https://www.uproxy.org/";

declare var core :CoreConnector;

class GoogleAuth {
  private tabId_ :number = -1;

  constructor() {
  }

  public login = () : void => {
    if (this.tabId_ === -1) {
      this.getAccessCode_();
    } else {
      chrome.tabs.update(this.tabId_, {active:true});
    }
  }

  private getAccessCode_ = () : void => {
    var extractCode = function(tabId, changeInfo, tab) {
      if (tab.id === this.tabId_ && tab.url.indexOf(REDIRECT_URI) === 0) {
        chrome.tabs.onUpdated.removeListener(extractCode);
        chrome.tabs.onRemoved.removeListener(onTabClose);
        this.tabId_ = -1;
        chrome.tabs.remove(tabId);
        if (tab.url.indexOf('error=access_denied') > 0) {
          this.onError_('User denied access.');
          return;
        }
        var code = tab.url.match(/code=([^&]+)/)[1];
        this.getToken_(code);
      }
    }.bind(this);
    var googleOAuth2Url = "https://accounts.google.com/o/oauth2/auth?" +
        "scope=email%20https://www.googleapis.com/auth/googletalk" +
        "&redirect_uri=" + REDIRECT_URI +
        "&response_type=code" +
        "&client_id=" + CLIENT_ID;
    var accountChooserUrl =
        'https://accounts.google.com/accountchooser?continue=' +
        encodeURIComponent(googleOAuth2Url);
    var onTabClose = function(tabId, removeInfo) {
        if (tabId == this.tabId_) {
          chrome.tabs.onUpdated.removeListener(extractCode);
          chrome.tabs.onRemoved.removeListener(onTabClose);
          this.tabId_ = -1;
          this.onError_('Login abandoned.');
        }
    }.bind(this);
    chrome.tabs.create({url: accountChooserUrl},
                       function(tab: chrome.tabs.Tab) {
      this.tabId_ = tab.id;
      chrome.tabs.onRemoved.addListener(onTabClose);
      chrome.tabs.onUpdated.addListener(extractCode);
    }.bind(this));
  }

  private getToken_ = (code :string) : void => {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "https://accounts.google.com/o/oauth2/token", false);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    var params = "code=" + code +
        "&client_id=" + CLIENT_ID +
        "&client_secret=" + CLIENT_SECRET +
        "&redirect_uri=" + REDIRECT_URI +
        "&grant_type=authorization_code";
    xhr.addEventListener('load', (event) => {
      if (xhr.status != 200) {
        this.onError_('Error getting credentials ' + xhr.status);
        return;
      }
      var resp = JSON.parse(xhr.response);
      this.getCredentials_(resp.access_token);
    }, false);

    xhr.addEventListener('error', function(evt) {
      this.onError_('Error occurred while trying to get Google oAuth token');
    }, false);

    xhr.send(params);
  }

  private getCredentials_ = (token :string) : void => {
    // Make googleapis request to get user's email address, then pass
    // credentials back to social provider.
    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', (evt) => {
      if (xhr.status == 200) {
        var response = JSON.parse(xhr.responseText);
        var credentials :GoogleTalkCredentials = {
            userId: response.email,
            jid: response.email,
            oauth2_token: token,
            oauth2_auth: 'http://www.google.com/talk/protocol/auth',
            host: 'talk.google.com'
        };
        this.sendCredentials_(credentials);
      } else {
      this.onError_('Error validating Google oAuth token');
      }
    }, false);
    xhr.addEventListener('error', (evt) => {
      this.onError_('Error occurred while validating Google oAuth token');
    }, false);
    xhr.open('GET', "https://www.googleapis.com/oauth2/v1/userinfo?alt=json", false);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.send();
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
