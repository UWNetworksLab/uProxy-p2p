var GOOGLE_TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=';

function AuthGoogle(cb) {
  this.credentialsCallback = cb;
  this.credentials = {
    userId: null,
    token: null
  };
};

AuthGoogle.prototype.login = function(interactive) {
  chrome.identity.getAuthToken({interactive: interactive}, (function(token) {
    this.validate(token);
  }).bind(this));
};

AuthGoogle.prototype.validate = function(token) {
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('load', (function(evt) {
    if (xhr.status == 200) {
      var resp = JSON.parse(xhr.responseText);
      this.credentials = {};
      this.credentials.userId = resp.email;
      this.credentials.token = token;
      console.log('Google credentials: ' + JSON.stringify(this.credentials));
      if (this.credentialsCallback) {
        this.credentialsCallback(this.credentials);
      } else {
        console.error('Missing Google credentials callback');
      }
    } else {
      console.error('Error validating Google oAuth token');
    }
  }).bind(this), false);
  xhr.addEventListener('error', (function(evt) {
    console.error('Error occurred while validating Google oAuth token');
  }).bind(this), false);
  xhr.open('get', GOOGLE_TOKENINFO_URL+token, true);
  xhr.send();
};

AuthGoogle.prototype.logout = function() {
  chrome.identity.removeCachedAuthToken({token: this.credentials.token}, (function() {
    this.credentials = null;
  }).bind(this));
};
