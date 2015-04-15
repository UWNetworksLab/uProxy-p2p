import UI = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');

// Chrome-specific dependencies.
export var ui :UI.UserInterface = (<any>chrome.extension.getBackgroundPage()).ui;
export var core = (<any>chrome.extension.getBackgroundPage()).core;
export var model :UI.Model = (<any>chrome.extension.getBackgroundPage()).model;
ui.browser = 'chrome';

console.log('Loaded dependencies for Chrome Extension.');
