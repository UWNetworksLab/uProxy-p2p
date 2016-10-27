/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import * as ui_model from '../../../generic_ui/scripts/model';
import * as ui_constants from '../../../interfaces/ui';
import * as user_interface from '../../../generic_ui/scripts/ui';
import CoreConnector from '../../../generic_ui/scripts/core_connector';
import ChromeCoreConnector from './chrome_core_connector';
import * as browser_connector from '../../../interfaces/browser_connector';

var background_context: any = (<any>chrome.extension.getBackgroundPage()).ui_context;
export var core :CoreConnector = background_context.core;
export var browserConnector :browser_connector.CoreBrowserConnector = background_context.browserConnector;

export var ui :user_interface.UserInterface =
    new user_interface.UserInterface(core,
        background_context.browserApi,
        background_context.backgroundUi);

export var model :ui_model.Model = ui.model;

console.log('Loaded dependencies for Chrome Extension.');
