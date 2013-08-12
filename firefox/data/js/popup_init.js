'use strict';

var freedom = new freedomShim("toolbar");
// Firefox does not have the same l10n & i18n interface as chrome,
// so it must be mocked.
// getMessage will be defined after the extension sends the popup the JSON
// with the internationalization data.
var chrome = {
  i18n: {}
};

var appendScript = function (scriptSrc) {
  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = scriptSrc;
  console.log('appending child script' + scriptSrc);
  document.getElementsByTagName('head')[0].appendChild(s);
  console.log(document.head.innerHTML);
};

addon.port.emit("show");
// angular.module('UProxyChromeExtension', []);
addon.port.on("l10n", function(l10n) {
  console.log("Initializing popup");
  chrome.i18n.getMessage = function(key) {
    console.log('get message');
    return l10n['key'].message;
  };
  appendScript('js/app.js');
  appendScript('js/popup.js');
});


