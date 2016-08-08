/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/index.d.ts'/>
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

// Launch the Chrome webstore page for the uProxy app,
// or activate the user's tab open to uproxy.org/install
function openDownloadAppPage() : void {
  chrome.tabs.query({}, function (tabs) {
    for (var i = 0; i < tabs.length; i++) {
      var url = tabs[i].url;
      if (url.indexOf('uproxysite.appspot.com/install') > 1 ||
          url.indexOf('uproxy.org/install') > 1) {
        chrome.tabs.update(tabs[i].id, { active: true });
        chrome.windows.update(tabs[i].windowId, { focused: true });
        return;
      }
    }

    // Only reached if the user didn't have uproxy.org/install open,
    // allowing us to assume the user is completeing the webstore install flow.
    // For consistency, we direct them to the app download page in the webstore
    // instead of uproxy.org.
    chrome.tabs.create(
      {url: 'https://chrome.google.com/webstore/detail/uproxyapp/fmdppkkepalnkeommjadgbhiohihdhii'},
      (tab) => {
        // Focus on the new Chrome Webstore tab.
        chrome.windows.update(tab.windowId, {focused: true});
      }
    );
    // After the app is installed via the webstore, open up uProxy.
    ui_context.browserConnector.onceConnected.then(ui_context.ui.browserApi.bringUproxyToFront);
  });
}

Polymer({
  downloadApp: function() {
    openDownloadAppPage();
  },
  ready: function() {
    this.model = ui_context.model;
  }
});
