/// <reference path='../../../../third_party/typings/index.d.ts'/>
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import ui_model = require('../../../generic_ui/scripts/model');
import ui_constants = require('../../../interfaces/ui');
import user_interface = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import ChromeCoreConnector = require('./chrome_core_connector');
import browser_connector = require('../../../interfaces/browser_connector');

var background_context: any = (<any>chrome.extension.getBackgroundPage()).ui_context;
export var core :CoreConnector = background_context.core;
export var browserConnector :browser_connector.CoreBrowserConnector = background_context.browserConnector;

export var ui :user_interface.UserInterface =
    new user_interface.UserInterface(core,
        background_context.browserApi,
        background_context.backgroundUi);

export var model :ui_model.Model = ui.model;

console.log('Loaded dependencies for Chrome Extension.');
