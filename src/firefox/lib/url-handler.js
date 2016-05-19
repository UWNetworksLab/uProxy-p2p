var { Cc, Ci, Cr } = require('chrome');
var tabUtils = require('sdk/tabs/utils');

var closeChannelTab = function(channel) {
  // See http://stackoverflow.com/questions/8098580/identify-tab-that-made-request-in-firefox-addon-sdk
  // and https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Tabbed_browser#Closing_a_tab
  // and https://developer.mozilla.org/en-US/Add-ons/SDK/Low-Level_APIs/tabs_utils
  var cb = channel.notificationCallbacks ||
      (channel.loadGroup && channel.loadGroup.notificationCallbacks);

  if (cb) {
    var domWin = cb.getInterface(Ci.nsIDOMWindow);
    var tab = tabUtils.getTabForContentWindow(domWin.top);
    tabUtils.closeTab(tab);
  }
}

var copyPasteRegEx = /^https:\/\/www.uproxy.org\/(request|offer)\/(.*)/;
var inviteRegEx = /^https:\/\/www.uproxy.org\/invite(.*)/;
var autocloseRegEx = /^https:\/\/www.uproxy.org\/autoclose(.*)/;

exports.setup = function(panel, button) {
  var observer = {
    observe: function (subject, topic, data) {
      if ('http-on-modify-request' !== topic) {
        return;
      }

      subject.QueryInterface(Ci.nsIHttpChannel);
      var url = subject.URI.spec

      if (copyPasteRegEx.test(url)) {
        panel.port.emit('copyPasteUrlData', url);
      } else if (inviteRegEx.test(url)) {
        panel.port.emit('inviteUrlData', url);
      } else if (autocloseRegEx.test(url)) {
        closeChannelTab(subject);
      } else {
        return;
      }

      panel.show({
        position: button
      });

      subject.cancel(Cr.NS_BINDING_ABORTED);
    }
  };

  var service = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
  service.addObserver(observer, 'http-on-modify-request', false);
};
