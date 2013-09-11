window.addEventListener("load", onload, false);

function onload() {
  var authMan = new AuthManager({
    name: 'google-auth',
    iconImg: 'res/icon.jpg',
    iconImgWidth: 50,
    signinImg: 'res/sign_in.jpg',
    signinImgWidth: 200
  });
};

AuthManager.prototype.login = function () {
  chrome.identity.getAuthToken({interactive: true}, (function(token) {
    this.credentials = {};
    this.credentials.token = token;
    this.getUserId();
  }).bind(this));
};

AuthManager.prototype.getUserId = function() {
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('load', (function(evt) {
    if (xhr.status == 200) {
      var resp = JSON.parse(xhr.responseText);
      this.credentials.userId = resp.email;
      if (this.port) {
        console.log('asdf');
        this.port.postMessage({
          cmd: this.opts.name,
          success: true,
          userId: this.credentials.userId,
          message: {email: this.credentials.userId, token: this.credentials.token}
        });
        this.updateStatus('online', '');
      } else {
        this.updateStatus('error', 'Port to Chrome App missing');
      }
    } else {
      this.updateStatus('error', 'Error validating oAuth token');
    }
  }).bind(this), false);
  xhr.addEventListener('error', (function(evt) {
    this.updateStatus('error', 'Error occurred while validating oAuth token');
  }).bind(this), false);
  xhr.open('get', 
    'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token='+this.credentials.token, 
    true);
  xhr.send();
};

AuthManager.prototype.logout = function () {
  chrome.identity.removeCachedAuthToken({token: this.credentials.token}, (function() {
    this.credentials = null;
    this.updateStatus('offline', '');
  }).bind(this));
};
