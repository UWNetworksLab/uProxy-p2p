/// <reference path='../../../interfaces/authentication-manager.d.ts' />

var GOOGLE_TOKENINFO_URL =
    'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=';

// Client ID associated with our redirect URL from Google Developers Console.
var CLIENT_ID =
    '746567772449-jkm5q5hjqtpq5m9htg9kn0os8qphra4d.apps.googleusercontent.com';

class AuthGoogle implements AuthenticationManager {
  constructor(public credentialsCallback, public errorCallback) {
    this.login(true);
  }

  public login = (interactive) => {
    // Always logout before logging in to Google.  This is to ensure that
    // the user always gets to pick their Google account.  If we did not
    // call logout first, the user might be logged into a different account
    // (possibly by another app/extension, as all apps/extensions share
    // the same sandboxed environment used by chrome.identity.launchWebAuthFlow)
    // and would be unable to pick the right account for uProxy.
    // Only invoke login popup after logout has been completed (asynchronously).
    this.logout().then(() => {
      var googleOAuth2Url = 'https://accounts.google.com/o/oauth2/auth?' +
        'response_type=token' +
        '&redirect_uri=' + encodeURIComponent(chrome.identity.getRedirectURL()) +
        '&client_id=' + encodeURIComponent(CLIENT_ID) +
        // Scopes are space-separated.
        '&scope=' + encodeURIComponent(
            'email https://www.googleapis.com/auth/googletalk');
      console.log('googleOAuth2Url: ' + googleOAuth2Url);
      chrome.identity.launchWebAuthFlow(
          {url: googleOAuth2Url, interactive: true},
          (responseUrl) => {
            console.log('Got google authentication response');
            if (chrome.runtime.lastError) {
              this.errorCallback('Error logging into Google: ',
                                 chrome.runtime.lastError);
              return;
            }

            // Parse Oauth2 token from responseUrl
            var token = responseUrl.match(/access_token=([^&]+)/)[1];
            if (!token) {
              this.errorCallback('Error getting token for Google');
              return;
            }

            this.getCredentials_(token);
          });
    });
  }

  private getCredentials_ = (token) => {
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
        if (this.credentialsCallback) {
          this.credentialsCallback(credentials);
        } else {
          this.errorCallback('Missing Google credentials callback');
        }
      } else {
        this.errorCallback('Error validating Google oAuth token');
      }
    }, false);
    xhr.addEventListener('error', (evt) => {
      this.errorCallback('Error occurred while validating Google oAuth token');
    }, false);
    xhr.open('get', GOOGLE_TOKENINFO_URL + encodeURIComponent(token), true);
    xhr.send();
  }

  public logout = () : Promise<void> => {
    return new Promise<void>((F, R) => {
      // Logout of Google so that next time login URL is invoked user can
      // sign in with a different account.  This must be launched using
      // launchWebAuthFlow so that sandboxed environment is logged out (so
      // this can't be done using an xhr request).
      chrome.identity.launchWebAuthFlow(
          {url: 'https://accounts.google.com/logout', interactive: false},
          (responseUrl) => {
            console.log('Successfully logged out of Google');
            F();
          });
    });
  }
}
