/// <reference path='../../../interfaces/authentication-manager.d.ts' />
/// <reference path='../../../uproxy.ts' />

var CLIENT_ID =
    "746567772449-bp2g60f0mq4g8u02pqcepm2mjttogrrt.apps.googleusercontent.com";
var CLIENT_SECRET = "Bmlc90_i2GFcaP26Fneq9UnO";

var REDIRECT_URI = "https://www.uproxy.org/";

class GoogleAuth {
  private code_;
  constructor() {
  }

	public login() {
		this.getAccessCode_();
  }

  private getAccessCode_() {
		chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
			if (tab.url.indexOf(REDIRECT_URI) === 0 && !this.code_) {
        // FIXME
				this.code_ = tab.url.match(/code=([^&]+)/)[1];
				chrome.tabs.remove(tabId);
				this.getToken_(this.code_);
			}
		}.bind(this));
    var googleOAuth2Url = "https://accounts.google.com/o/oauth2/auth?" +
           "scope=email%20https://www.googleapis.com/auth/googletalk" +
           "&redirect_uri=" + REDIRECT_URI +
           "&response_type=code" +
           "&client_id=" + CLIENT_ID;
		chrome.tabs.create({url: googleOAuth2Url});
	}
  
  private getToken_(code) {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "https://accounts.google.com/o/oauth2/token", false);
		xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		xhr.setRequestHeader("Access-Control-Allow-Origin",
													"chrome-extension://pjpcdnccaekokkkeheolmpkfifcbibnj");
		var params = "code=" + code +
								 "&client_id=" + CLIENT_ID +
								 "&client_secret=" + CLIENT_SECRET +
								 "&redirect_uri=" + REDIRECT_URI +
								 "&grant_type=authorization_code";
		xhr.addEventListener('load', function(event) {
      if (xhr.status != 200) {
         this.onError_();
      }
			var resp = JSON.parse(xhr.response);
			this.getCredentials_(resp.access_token);
		}.bind(this), false);
    xhr.addEventListener('error', function(evt) {
      this.onError_('Error occurred while trying to get Google oAuth token');
    }, false);
		xhr.send(params);
	}


  private getCredentials_(token :string) {
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
  
  private onError_(errorText :string) {
    core.sendCommand(uProxy.Command.SEND_CREDENTIALS,
										 {cmd: 'error',
											message: errorText});
  }

  private sendCredentials_(credentials :GoogleTalkCredentials) {
    core.sendCommand(uProxy.Command.SEND_CREDENTIALS,
										 {cmd: 'auth',
											message: credentials});
  }
}
