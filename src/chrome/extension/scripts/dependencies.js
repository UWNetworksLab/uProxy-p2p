// Chrome-specific dependencies.
// TODO: Convert to typescript
'use strict';

var core = chrome.extension.getBackgroundPage().core;
var chromeBrowserApi = chrome.extension.getBackgroundPage().chromeBrowserApi;
var ui = new UI.UserInterface(core, chromeBrowserApi);
var browser = 'chrome';

// Functions used by app-missing.ts which need access to the background page.
var openDownloadAppPage = chrome.extension.getBackgroundPage().openDownloadAppPage;
core.ui = ui;
core.getInitialState();

console.log('Loaded dependencies for Chrome Extension.');
