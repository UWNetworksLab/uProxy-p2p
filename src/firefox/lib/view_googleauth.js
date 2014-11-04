var tabs = require("sdk/tabs");
var self = require("sdk/self");
const {XMLHttpRequest} = require("sdk/net/xhr");

var CLIENT_ID =
    "746567772449-bp2g60f0mq4g8u02pqcepm2mjttogrrt.apps.googleusercontent.com";
var CLIENT_SECRET = "Bmlc90_i2GFcaP26Fneq9UnO";

var REDIRECT_URI = "https://www.uproxy.org/";

var View_googleAuth = function (app, dispatchEvent) {
  this.dispatchEvent = dispatchEvent;
  this.app = app;
};

View_googleAuth.prototype.open = function (name, what, continuation) {
  continuation(false);
};

View_googleAuth.prototype.show = function (continuation) {
  googleAuth(this.dispatchEvent, continuation);
};

View_googleAuth.prototype.postMessage = function (args, continuation) {
  continuation();
};

View_googleAuth.prototype.close = function (continuation) {
  continuation();
};

View_googleAuth.prototype.onMessage = function (m) {
};

function googleAuth(dispatchEvent, continuation) {
  var googleOAuth2Url = "https://accounts.google.com/o/oauth2/auth?" +
      "scope=email%20https://www.googleapis.com/auth/googletalk" +
      "&redirect_uri=" + REDIRECT_URI +
      "&response_type=code" +
      "&client_id=" + CLIENT_ID;
  var accountChooserUrl =
      'https://accounts.google.com/accountchooser?continue=' +
      encodeURIComponent(googleOAuth2Url);
  tabs.open({
    url: accountChooserUrl,
    isPrivate: true,
    onLoad: function onLoad(tab) {
      var url = tab.url;
      if (url.startsWith(REDIRECT_URI)) {
        var code = url.match(/code=([^&]+)/)[1];
        getToken(code, dispatchEvent, continuation);
        tab.close();
      }
    }
 })
}

function getToken(authorization_code, dispatchEvent, continuation) {
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "https://accounts.google.com/o/oauth2/token", false);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  var params = "code=" + authorization_code +
               "&client_id=" + CLIENT_ID +
               "&client_secret=" + CLIENT_SECRET +
               "&redirect_uri=" + REDIRECT_URI +
               "&grant_type=authorization_code";
  xhr.onload = function() {
    var resp = JSON.parse(xhr.response);
    getUserInfo(resp.access_token, dispatchEvent, continuation);
  }
  xhr.send(params);
}

function getUserInfo(token, dispatchEvent, continuation) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://www.googleapis.com/oauth2/v1/userinfo?alt=json", false);
  xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  xhr.onload = function() {
    var response = JSON.parse(xhr.response);
    credentials = {
      userId: response.email,
      jid: response.email,
      oauth2_token: token,
      oauth2_auth: 'http://www.google.com/talk/protocol/auth',
      host: 'talk.google.com'
    };
    dispatchEvent('message', {cmd: 'auth', message: credentials});
    continuation();
  }
  xhr.send();
}

exports.View_googleAuth = View_googleAuth;
