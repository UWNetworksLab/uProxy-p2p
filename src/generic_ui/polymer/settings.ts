/// <reference path='./context.d.ts' />

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  displayAdvancedSettings: false,
  advancedSettings: JSON.stringify(model.globalSettings, null, ' '),
  logOut: function() {
    ui.logout({name: model.onlineNetwork.name,
                                   userId: model.onlineNetwork.userId}).then(() => {
      // Nothing to do here - the UI should receive a NETWORK update
      // saying that the network is offline, and will update the display
      // as result of that.
    }).catch((e :Error) => {
      console.error('logout returned error: ', e);
    });
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
  ready: function() {
    this.ui = ui;
    this.model = model;
  }
});
