var ui;

var core;

var proxyConfig = new BrowserProxyConfig();

var model = {
    networks: {},
    roster: []
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

var port = self.port;

unsafeWindow.ui = ui;
unsafeWindow.model = model;
unsafeWindow.core = core;
