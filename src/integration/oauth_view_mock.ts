
var REDIRECT_URL = 'http://localhost';
var CLIENT_ID =
    '746567772449-mv4h0e34orsf6t6kkbbht22t9otijip0.apps.googleusercontent.com';
var CLIENT_SECRET = 'M-EGTuFRaWLS5q_hygpJZMBu';

export class OAuthView {
  public refreshToken :string = null;
  public initiateOAuth = (redirectURIs :string[], continuation :Function) => {
    continuation({redirect: REDIRECT_URL, state: ''});
    return true;
  }

  public launchAuthFlow = (authUrl :string,
                           stateObj :Object,
                           continuation :Function) => {
    if (!this.refreshToken) {
      continuation(undefined, 'No refreshToken set.');
      return;
    }
    return Helper.getAccessToken(this.refreshToken).then(function(accessToken) {
      continuation(REDIRECT_URL + '?access_token=' + accessToken);
    }).catch(function(e) {
      continuation(undefined, 'Failed to get access token');
    });
  }
}

var Helper = {
  // Returns a Promise that fulfills with an access token.
  getAccessToken: function(refreshToken :string) {
    return new Promise(function(fulfill, resolve) {
      var data = 'refresh_token=' + refreshToken +
          '&client_id=' + CLIENT_ID +
          '&client_secret=' + CLIENT_SECRET +
          '&grant_type=refresh_token';
      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/oauth2/v3/token', true);
      xhr.setRequestHeader('content-type', 'application/x-www-form-urlencoded');
      xhr.onload = function() {
        fulfill(JSON.parse(this.response).access_token);
      };
      xhr.send(data);
    });
  }
};  // end of Helper
