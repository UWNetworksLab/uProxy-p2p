// TODO(salomegeo): rewrite it in typescript.
var ui;

var core;

var proxyConfig = new BrowserProxyConfig();

var model = {
    networks: [],
    contacts: {
      'onlineTrustedUproxy': [],
      'offlineTrustedUproxy': [],
      'onlineUntrustedUproxy': [],
      'offlineUntrustedUproxy': [],
      'onlineNonUproxy': [],
      'offlineNonUproxy': []
    }
};

function initUI() {
    var firefoxConnector = new FirefoxConnector();
    core = new CoreConnector(firefoxConnector);
    var browserAction = new FirefoxBrowserAction();

    return new UI.UserInterface(core, browserAction);
}

if (undefined === ui) {
    ui = initUI();
}

// This runs in contents script. In order to pass objects to page script
// we need to set fields on unsafeWindow object.
unsafeWindow.ui = ui;
unsafeWindow.model = model;
unsafeWindow.core = core;
