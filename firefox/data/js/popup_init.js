'use strict';

var freedom = new freedomShim("toolbar");
// Firefox does not have the same l10n & i18n interface as chrome,
// so it must be mocked.
// getMessage will be defined after the extension sends the popup the JSON
// with the internationalization data.
var chrome = {
  i18n: {
    getMessage: function () {
      return "";
    }
  },
  extension: {
    getBackgroundPage: function () {
      return {
	freedom: freedom,
	clearPopupListeners: function () {},
	addPopupListener: function () {}
      };
    }
  }
};

addon.port.emit("show");
addon.port.on("l10n", function(l10n) {
  chrome.i18n.getMessage = function(key) {
    console.log('get message');
    return l10n['key'].message;
  };
});
