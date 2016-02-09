
var REDIRECT_URL = 'http://localhost';
var CLIENT_ID =
    '746567772449-jkm5q5hjqtpq5m9htg9kn0os8qphra4d.apps.googleusercontent.com';
var CLIENT_SECRET = 'h_hfPI4jvs9fgOgPweSBKnMu';

export class MockOAuth {
  constructor(public refreshToken :string) {
  }

  public initiateOAuth = (redirectURIs :string[], continuation :Function) => {
    continuation({redirect: REDIRECT_URL, state: ''});
    return true;
  }

  public launchAuthFlow = (authUrl :string,
                           stateObj :Object,
                           interactive :boolean,
                           continuation :Function) => {
    if (!this.refreshToken) {
      continuation(undefined, 'No refreshToken set.');
      return;
    }
    return this.getAccessToken(this.refreshToken).then(function(accessToken) {
      continuation(REDIRECT_URL + '?access_token=' + accessToken);
    }).catch(function(e) {
      continuation(undefined, 'Failed to get access token');
    });
  }

  // Returns a Promise that fulfills with an access token.
  public getAccessToken = (refreshToken :string) => {
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
};  // end of MockOAuth
