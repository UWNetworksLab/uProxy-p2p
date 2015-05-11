/// <reference path='./context.d.ts' />

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  displayAdvancedSettings: false,
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
  toggleAdvancedSettings: function() {
    this.displayAdvancedSettings = !this.displayAdvancedSettings;
    if (!this.displayAdvancedSettings) {
      // Hiding the advanced settings will also hide the confirmation
      // messages.
      this.$.confirmNewServer.hidden = true;
      this.$.confirmResetServers.hidden = true;
    }
  },
  setStunServer: function() {
    model.globalSettings.stunServers = [{urls: [this.stunServer]}];
    this.saveGlobalSettings();
    if(!this.$.confirmResetServers.hidden) {
      this.$.confirmResetServers.hidden = true;
    }
    this.$.confirmNewServer.hidden = false;
  },
  resetStunServers: function() {
    model.globalSettings.stunServers = [];
    core.updateGlobalSettings(model.globalSettings);
    if(!this.$.confirmNewServer.hidden) {
      this.$.confirmNewServer.hidden = true;
    }
    this.$.confirmResetServers.hidden = false;
  },
  openFeedbackForm: function() {
    this.fire('core-signal', {name: 'open-feedback'});
  },
  saveGlobalSettings: function() {
    core.updateGlobalSettings(model.globalSettings);
  },
  observe: {
    'model.globalSettings.statsReportingEnabled' : 'saveGlobalSettings'
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
  }
});
