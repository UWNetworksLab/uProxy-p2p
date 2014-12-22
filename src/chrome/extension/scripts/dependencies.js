// Chrome-specific dependencies.
// TODO: Convert to typescript
'use strict';

var core = chrome.extension.getBackgroundPage().core;
var openDownloadAppPage = chrome.extension.getBackgroundPage().openDownloadAppPage;
var browserApi = chrome.extension.getBackgroundPage().chromeBrowserApi;
var ui = new UI.UserInterface(core, browserApi);
console.log('Loaded dependencies for Chrome Extension.');
