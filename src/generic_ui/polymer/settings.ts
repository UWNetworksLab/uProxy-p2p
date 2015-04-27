/// <reference path='./context.d.ts' />

Polymer({
  displayAdvancedSettings: false,
  logOut: function() {
    ui_context.ui.logout({name: ui_context.model.onlineNetwork.name,
                                   userId: ui_context.model.onlineNetwork.userId}).then(() => {
      // Nothing to do here - the UI should receive a NETWORK update
      // saying that the network is offline, and will update the display
      // as result of that.
    }).catch((e :Error) => {
      console.error('logout returned error: ', e);
    });
  },
  restart: function() {
    ui_context.core.restart();
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
    ui_context.model.globalSettings.stunServers = [{urls: [this.stunServer]}];
    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
    if(!this.$.confirmResetServers.hidden) {
      this.$.confirmResetServers.hidden = true;
    }
    this.$.confirmNewServer.hidden = false;
  },
  resetStunServers: function() {
    ui_context.model.globalSettings.stunServers = [];
    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
    if(!this.$.confirmNewServer.hidden) {
      this.$.confirmNewServer.hidden = true;
    }
    this.$.confirmResetServers.hidden = false;
  },
  openFeedbackForm: function() {
    this.fire('core-signal', {name: 'open-feedback'});
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  }
});
