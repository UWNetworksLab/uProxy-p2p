var FACEBOOK_APP_ID = '161927677344933';
var FACEBOOK_REDIRECT_URI = 'https://hilnpmepiebcjhibkbkfkjkacnnclkmi.chromiumapp.org/';
//FACEBOOK_REDIRECT_URI = 'https://www.facebook.com/connect/login_success.html';
var FACEBOOK_TOKENINFO_URL = 'https://graph.facebook.com/me?access_token=';
var FACEBOOK_OAUTH_SCOPES = 'email,xmpp_login,user_online_presence,friends_online_presence';

function AuthFacebook(credCallback, errorCallback) {
  this.credentialsCallback = credCallback;
  this.errorCallback = errorCallback;
  this.credentials = {
    userId: null,
    token: null
  };
};

AuthFacebook.prototype.login = function(interactive) {
  chrome.identity.launchWebAuthFlow({
    url: 'https://www.facebook.com/dialog/oauth?' +
      'client_id=' + encodeURIComponent(FACEBOOK_APP_ID) +
      '&redirect_uri=' + encodeURIComponent(FACEBOOK_REDIRECT_URI) +
      '&scope=' + encodeURIComponent(FACEBOOK_OAUTH_SCOPES) +
      '&response_type=token',
    interactive: interactive
  }, (function(responseUrl) {
    //Parse the responseUrl
    console.log(responseUrl);
    var query = {};
    if (responseUrl && responseUrl.indexOf('#') >= 0) {
      var queryTok = responseUrl.substr(responseUrl.indexOf('#') + 1).split('&');
      for (var i = 0; i < queryTok.length; i++) {
        var tmp = queryTok[i].split('=');
        if (tmp.length > 1) {
          query[tmp[0]] = tmp[1];
        }
      }
    }
    //If success
    if (query.access_token) {
      this.validate(query.access_token);
    } else if (query.code) {
      this.errorCallback('Facebook Auth: Received code, expecting token');
    } else if (query.error) {
      this.errorCallback("Facebook Auth: " + query.error + ": " + query.error_reason);
    } else {
      this.errorCallback("Facebook Auth failed: " + JSON.stringify(query));
    }
  }).bind(this));

};

AuthFacebook.prototype.validate = function(token) {
  var xhr = new XMLHttpRequest();
  xhr.addEventListener('load', (function(evt) {
    if (xhr.status == 200) {
      var resp = JSON.parse(xhr.responseText);
      this.credentials = {};
      this.credentials.userId = '-' + resp.id + '@chat.facebook.com';
      this.credentials.token = token;
      console.log(resp);
      if (this.credentialsCallback) {
        this.credentialsCallback(this.credentials);
      } else {
        this.errorCallback('Missing credentials callback for Facebook');
      }
    } else {
      this.errorCallback('Error validating Facebook oAuth token');
    }
  }).bind(this), false);
  xhr.addEventListener('error', (function(evt) {
    this.errorCallback('Error occurred while validating Facebook oAuth token');
  }).bind(this), false);
  xhr.open('get', FACEBOOK_TOKENINFO_URL + token, true);
  xhr.send();
};

AuthFacebook.prototype.logout = function() {
  chrome.identity.removeCachedAuthToken({token: this.credentials.token}, (function() {
    console.log('Logout - Facebook - Removing cached credentials');
    this.credentials = null;

  }).bind(this));
};
