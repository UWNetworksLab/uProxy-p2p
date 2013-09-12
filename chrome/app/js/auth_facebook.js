var FACEBOOK_APP_ID = '161927677344933';
var FACEBOOK_REDIRECT_URI = 'https://hilnpmepiebcjhibkbkfkjkacnnclkmi.chromiumapp.org/';
var FACEBOOK_TOKENINFO_URL = 'https://graph.facebook.com/me?access_token=';

function AuthFacebook(cb) {
  this.credentialsCallback = cb;
  this.credentials = {
    userId: null,
    token: null
  };
};

AuthFacebook.prototype.login = function(interactive) {
  chrome.identity.launchWebAuthFlow({
    url: 'https://www.facebook.com/dialog/oauth?' + 
      'client_id=' + FACEBOOK_APP_ID +
      '&redirect_uri=' + FACEBOOK_REDIRECT_URI + 
      '&response_type=token',
    interactive: interactive
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
      console.error('Facebook Auth: Received code, expecting token');
    } else if (query.error) {
      console.error("Facebook Auth: " + query.error + ": " + query.error_reason);
    } else {
      console.error("Facebook Auth: " + JSON.stringify(query));
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
        console.error('Missing credentials callback for Facebook');
      }
    } else {
      console.error('Error validating Facebook oAuth token');
    }
  }).bind(this), false);
  xhr.addEventListener('error', (function(evt) {
    console.error('Error occurred while validating Facebook oAuth token');
  }).bind(this), false);
  xhr.open('get', FACEBOOK_TOKENINFO_URL + token, true);
  xhr.send();
};

AuthFacebook.prototype.logout = function() {
  chrome.identity.removeCachedAuthToken({token: this.credentials.token}, (function() {
    this.credentials = null;
  }).bind(this));
};
