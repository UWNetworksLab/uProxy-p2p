/// <reference path='../../../../../third_party/typings/chrome/chrome.d.ts' />
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import ui_model = require('../../../generic_ui/scripts/model');
import user_interface = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import CordovaCoreConnector = require('./cordova_core_connector');

var ui_context :UiGlobals;
export var browserConnector = new CordovaCoreConnector({
  name: 'uproxy-ui-to-core-connector'
});
export var core = new CoreConnector(browserConnector);
export var ui :user_interface.UserInterface;
export var model :ui_model.Model;

chrome.runtime.getBackgroundPage((bgPage) => {
  ui_context = (<any>bgPage).ui_context;
  ui = new user_interface.UserInterface(core, ui_context.browserApi);
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

