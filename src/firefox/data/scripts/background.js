var ui;

var core;

var proxyConfig = new BrowserProxyConfig();

var model = {
    networks: {},
    roster: []
};
/*
chrome.runtime.onInstalled.addListener(function (details) {
    console.log('onInstalled: previousVersion', details.previousVersion);
});

chrome.runtime.onSuspend.addListener(function () {
    console.log('onSuspend');
});
*/
function initUI() {
    core = new ChromeCoreConnector({ name: 'uproxy-extension-to-app-port' });
    var notifications = new FirefoxNotifications();

    return new UI.UserInterface(core, notifications);
}

console.log('Initializing chrome extension background page...');
if (undefined === ui) {
    ui = initUI();
}

unsafeWindow.ui = ui;
unsafeWindow.model = model;
unsafeWindow.core = core;
