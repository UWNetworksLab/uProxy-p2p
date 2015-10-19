/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

declare var require: (path: string) => Object;
import ui_constants = require('../../interfaces/ui');

Polymer({
  loginToQuiver: function() {
    console.log('loginToQuiver called, ' + this.userName);  // TODO: remove
    model.globalSettings.quiverUserName = this.userName;
    core.updateGlobalSettings(model.globalSettings);
    ui.login('Quiver', this.userName).then(() => {
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', { view: ui_constants.View.ROSTER });
      this.closeQuiverLoginPanel();
    }).catch((e: Error) => {
      console.warn('Did not log in ', e);
    });
  },
  openQuiverLoginPanel: function() {
    this.userName = model.globalSettings.quiverUserName;
    this.$.quiverLoginPanel.open();
  },
  closeQuiverLoginPanel: function() {
    this.$.quiverLoginPanel.close();
  },
  ready: function() {
    this.userName = '';
  }
});
