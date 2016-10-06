/// <reference path='../../../../third_party/typings/index.d.ts'/>
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import * as background_ui from '../../../generic_ui/scripts/background_ui';
import * as ui_model from '../../../generic_ui/scripts/model';
import * as user_interface from '../../../generic_ui/scripts/ui';
import CoreConnector from '../../../generic_ui/scripts/core_connector';
import CordovaCoreConnector from './cordova_core_connector';
import * as same_context_panel_connector from '../../../generic_ui/scripts/same_context_panel_connector';

export var browserConnector = new CordovaCoreConnector({
  name: 'uproxy-ui-to-core-connector'
});
export var core = new CoreConnector(browserConnector);
export var ui :user_interface.UserInterface;
export var model :ui_model.Model;

export var panelConnector = new same_context_panel_connector.SameContextPanelConnector();
var backgroundUi = new background_ui.BackgroundUi(panelConnector, core);

chrome.runtime.getBackgroundPage((bgPage) => {
  var ui_context = (<any>bgPage).ui_context;
  ui = new user_interface.UserInterface(core, ui_context.browserApi, backgroundUi);
  model = ui.model;
  console.log('Got references from background page; importing vulcanized');

  var link = document.createElement('link');
  link.rel = 'import';
  link.href = 'generic_ui/polymer/vulcanized.html'
  link.onload = function(e) {
    // Setting document.body.innerHTML is forbidden, because CCA uses
    // an <iframe> in this page to represent the background page.
    var root = document.createElement('uproxy-root');
    document.body.appendChild(root);
  };
  link.onerror = function(e) {
    console.log('Error while loading polymer/vulcanized.html:', e);
  };
  document.head.appendChild(link);
});
