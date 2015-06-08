/// <reference path='./context.d.ts' />

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  logOut: function() {
    // logout all networks asynchronously
    for (var i in model.onlineNetworks) {
      ui.logout({
        name: model.onlineNetworks[i].name,
        userId: model.onlineNetworks[i].userId
      }).catch((e :Error) => {
        console.error('logout returned error: ', e);
      });
    }
  },
  restart: function() {
    core.restart();
  },
  openFeedbackForm: function() {
    this.fire('core-signal', {name: 'open-feedback'});
  },
  openAdvancedSettingsForm: function() {
    this.fire('core-signal', {name: 'open-advanced-settings'});
  },
  observe: {
    'model.globalSettings.statsReportingEnabled' : 'saveGlobalSettings'
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
  }
});
