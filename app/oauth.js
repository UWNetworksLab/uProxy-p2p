/**
 * Return an Email, Token pair using the chrome identity API to get access to the
 * active Google Profile.
 */
var getCredentials = function(callback) {
  var onUserInfoFetched = function(token, event) {
    if (this.status != 200) {
      callback();
      return;
    }
    try {
      var info = JSON.parse(this.response);
      if (!info.email) {
        throw new Error("No Email");
      }
      callback({
        email: info.email,
        token: token
      });
    } catch(e) {
      callback();
    }
  }

  // Check if a valid token is returned, if it is, fetch the email associated
  // with the account.
  var onGetAuthToken = function(token) {
    if (!token) {
      callback();
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.onload = onUserInfoFetched.bind(xhr, token);
      xhr.send();
    }
  }

  // Request an Auth Token - this brings up a dialog for the user to approve
  // the first time it is called.
  chrome.experimental.identity.getAuthToken({ 'interactive': true }, onGetAuthToken);
}