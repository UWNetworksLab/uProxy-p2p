var FACEBOOK_APP_ID = '161927677344933';
var FACEBOOK_REDIRECT_URI = 'https://opedeinldpclhihojdgahbpjnndkfmhe.chromiumapp.org/';

window.addEventListener("load", onload, false);

function onload() {
  var authMan = new AuthManager({
    name: 'facebook-auth',
    iconImg: 'res/icon.png',
    iconImgWidth: 50,
    signinImg: 'res/sign_in.png',
    signinImgWidth: 200
  });
};

AuthManager.prototype.login = function () {
  chrome.identity.launchWebAuthFlow({
    url: 'https://www.facebook.com/dialog/oauth?' + 
      'client_id=' + FACEBOOK_APP_ID +
      '&redirect_uri=' + FACEBOOK_REDIRECT_URI + 
      '&response_type=token',
    interactive: true
  }, (function(responseUrl) {
    //Parse the responseUrl
    var queryTok = responseUrl.substr(responseUrl.indexOf('#') + 1).split('&');
    var query = {};
    for (var i = 0; i < queryTok.length; i++) {
      var tmp = queryTok[i].split('=');
      if (tmp.length > 1) {
        query[tmp[0]] = tmp[1];
      }
    }
    //If success
    if (query.access_token) {
      this.validate(query.access_token);
    } else if (query.code) {
      this.updateStatus('error', 'Received code, expecting token');
    } else if (query.error) {
      this.updateStatus('error', query.error + ": " + query.error_reason);
    } else {
      this.updateStatus('error', JSON.stringify(query));
    }
  }).bind(this));
};

AuthManager.prototype.validate = function(token) {
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('load', (function(evt) {
    if (xhr.status == 200) {
      var resp = JSON.parse(xhr.responseText);
      this.credentials = {};
      this.credentials.userId = '-' + resp.id + '@chat.facebook.com';
      this.credentials.token = token;
      console.log(resp);
      if (this.port) {
        this.port.postMessage({
          cmd: this.opts.name,
          success: true,
          userId: this.credentials.userId,
          message: {email: this.credentials.userId, token: this.credentials.token}
        });
        this.updateStatus('online', resp.first_name + " " + resp.last_name); 
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
    'https://graph.facebook.com/me?access_token=' + token,
    true);
  xhr.send();
};

AuthManager.prototype.logout = function () {
  chrome.identity.removeCachedAuthToken({token: this.credentials.token}, (function() {
    this.credentials = null;
    this.updateStatus('offline', '');
  }).bind(this));
};
