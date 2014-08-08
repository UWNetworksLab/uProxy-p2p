/// <reference path='../../../interfaces/authentication-manager.d.ts' />
/// <reference path='../../../uproxy.ts' />

var CLIENT_ID =
    "746567772449-bp2g60f0mq4g8u02pqcepm2mjttogrrt.apps.googleusercontent.com";
var CLIENT_SECRET = "Bmlc90_i2GFcaP26Fneq9UnO";

var REDIRECT_URI = "https://www.uproxy.org/";

class GoogleAuth {
  constructor() {
  }

  public login = () : void => {
    this.getAccessCode_();
  }

  private getAccessCode_ = () : void => {
    var extractCode = (tabId, changeInfo, tab) => {
			console.log('tab url is ' + tab.url);
      if (tab.url.indexOf(REDIRECT_URI) === 0) {
        var code = tab.url.match(/code=([^&]+)/)[1];
				chrome.tabs.onUpdated.removeListener(extractCode);
        chrome.tabs.remove(tabId);
        this.getToken_(code);
      }
    };
    chrome.tabs.onUpdated.addListener(extractCode);
    var googleOAuth2Url = "https://accounts.google.com/o/oauth2/auth?" +
        "scope=email%20https://www.googleapis.com/auth/googletalk" +
        "&redirect_uri=" + REDIRECT_URI +
        "&response_type=code" +
        "&client_id=" + CLIENT_ID;
    var accountChooserUrl =
        'https://accounts.google.com/accountchooser?continue=' +
        encodeURIComponent(googleOAuth2Url);
    chrome.tabs.create({url: accountChooserUrl});
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
