/// <reference path='../../../../../third_party/typings/chrome/chrome.d.ts' />
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import ui_constants = require('../../../interfaces/ui');
import user_interface = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');

var panel :StaticInPanel = (<any>chrome.extension.getBackgroundPage()).browserified_exports;
export var ui :user_interface.UserInterface= panel.ui;
export var core :CoreConnector = panel.core;
export var chromeCoreConnector = (<any>panel).chromeCoreConnector;
export var model :user_interface.Model = panel.model;
ui.browser = 'chrome';

console.log('Loaded dependencies for Chrome Extension.');
