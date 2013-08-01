'use strict';

var freedom = new freedomShim("toolbar");

var OAUTH_CONFIG = {
  "client_id": "814927071113-ri9amn1jl73c7rbh2dvif2g78fok8vs9.apps.googleusercontent.com",
  "client_secret": "JxrMEKHEk9ELTTSPgZ8IfZu-",
  "api_scope": "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/googletalk"
};

addon.port.emit("show");
// angular.module('UProxyChromeExtension', []);
// addon.port.on("l10n", function(l10n) {
//   console.log("Initializing popup");
//   app(l10n);
//   popup();
// });

freedom.on('state-change', function(change) {
    console.log('state-change called with: ' + change);
});

console.log("Sending hello world");
freedom.emit("send-message", {to:'', message: 'Hello World'});




