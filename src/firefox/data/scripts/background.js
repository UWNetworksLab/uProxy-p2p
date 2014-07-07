var ui;

var core;

var proxyConfig = new BrowserProxyConfig();

var model = {
    networks: {},
    roster: []
};

function initUI() {
    core = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
    var notifications = new FirefoxNotifications();

    return new UI.UserInterface(core, notifications);
}

if (undefined === ui) {
    ui = initUI();
}

unsafeWindow.ui = ui;
unsafeWindow.model = model;
unsafeWindow.core = core;


/*
unsafeWindow.ui = cloneInto(ui, unsafeWindow);
ui = unsafeWIndow.ui;
unsafeWindow.model = cloneInto(model, unsafeWindow);
model = unsafeWIndow.model;
unsafeWindow.core = cloneInto(core, unsafeWindow);
core = unsafeWIndow.core;
*/

