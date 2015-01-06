// TODO(salomegeo): rewrite it in typescript.
var ui;

var core;

function initUI() {
    var firefoxConnector = new FirefoxConnector();
    core = new CoreConnector(firefoxConnector);
    var firefoxBrowserApi = new FirefoxBrowserApi();

    return new UI.UserInterface(core, firefoxBrowserApi);
}

if (undefined === ui) {
    ui = initUI();
}

var browser = 'firefox';
