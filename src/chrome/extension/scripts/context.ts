/// <reference path='../../../../../third_party/typings/chrome/chrome.d.ts' />
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import ui_constants = require('../../../interfaces/ui');
import user_interface = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import ChromeCoreConnector = require('./chrome_core_connector');

interface ChromeGlobals extends UiGlobals {
  chromeCoreConnector :ChromeCoreConnector;
}

var ui_context :ChromeGlobals = (<any>chrome.extension.getBackgroundPage()).ui_context;
export var core :CoreConnector = ui_context.core;
export var chromeCoreConnector = ui_context.chromeCoreConnector;
export var model :user_interface.Model = ui_context.model;

export var ui :user_interface.UserInterface = new user_interface.UserInterface(core, ui_context.browserApi);

ui.browser = 'chrome';

console.log('Loaded dependencies for Chrome Extension.');
