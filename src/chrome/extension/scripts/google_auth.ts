
/// <reference path='../../../uproxy.ts' />
/// <reference path='chrome_tab_auth.ts' />

var CLIENT_ID =
    "746567772449-bp2g60f0mq4g8u02pqcepm2mjttogrrt.apps.googleusercontent.com";
var CLIENT_SECRET = "Bmlc90_i2GFcaP26Fneq9UnO";

class GoogleAuth extends ChromeTabAuth {
  constructor() {
    super();
  }

  public getOauthUrl = (redirctUrl) : string => {
    var googleOAuth2Url = "https://accounts.google.com/o/oauth2/auth?" +
        "scope=email%20https://www.googleapis.com/auth/googletalk" +
        "&redirect_uri=" + redirctUrl +
        "&response_type=code" +
        "&client_id=" + CLIENT_ID;
    return 'https://accounts.google.com/accountchooser?continue=' +
        encodeURIComponent(googleOAuth2Url);
  }

  public extractCode = (url) : Promise<any> => {
    if (url.indexOf('error=access_denied') > 0) {
      return Promise.reject('User denied access.');
    }

    var code = url.match(/code=([^&]+)/)[1];
    return this.getToken_(code).then((token) => {
      return this.getCredentials_(token);
    });
  }

  private getToken_ = (code :string) : Promise<string> => {
    return new Promise<string>((fulfill, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://accounts.google.com/o/oauth2/token", false);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      var params = "code=" + code +
          "&client_id=" + CLIENT_ID +
          "&client_secret=" + CLIENT_SECRET +
          "&redirect_uri=" + REDIRECT_URL +
          "&grant_type=authorization_code";
      xhr.addEventListener('load', (event) => {
        if (xhr.status != 200) {
          reject('Error getting credentials ' + xhr.status);
          return;
        }
        var resp = JSON.parse(xhr.response);
        fulfill(resp.access_token);
      }, false);

      xhr.addEventListener('error', function(evt) {
        reject('Error occurred while trying to get Google oAuth token');
      }, false);

      xhr.send(params);
    });
  }

  private getCredentials_ = (token :string) : Promise<any> => {
    return new Promise<GoogleTalkCredentials>((fulfill, reject) => {
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
          fulfill(credentials);
        } else {
        reject('Error validating Google oAuth token');
        }
      }, false);
      xhr.addEventListener('error', (evt) => {
        reject('Error occurred while validating Google oAuth token');
      }, false);
      xhr.open('GET', "https://www.googleapis.com/oauth2/v1/userinfo?alt=json", false);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.send();
    });
  }
}
