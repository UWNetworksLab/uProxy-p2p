declare var browser :string;

Polymer({
  model: model,
  browser: browser,
  DEFAULT_STUN_SERVERS: [{urls: ['stun:stun.l.google.com:19302']},
                         {urls: ['stun:stun1.l.google.com:19302']},
                         {urls: ['stun:stun2.l.google.com:19302']},
                         {urls: ['stun:stun3.l.google.com:19302']},
                         {urls: ['stun:stun4.l.google.com:19302']}],
  displayAdvancedSettings: false,
  logOut: function() {
    core.logout({name: model.onlineNetwork.name,
                 userId: model.onlineNetwork.userId}).then(() => {
      // Nothing to do here - the UI should receive a NETWORK update
      // saying that the network is offline, and will update the display
      // as result of that.
    }).catch((e) => {
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
    core.updateGlobalSettings(model.globalSettings);
    if(!this.$.confirmResetServers.hidden) {
      this.$.confirmResetServers.hidden = true;
    }
    this.$.confirmNewServer.hidden = false;
  },
  resetStunServers: function() {
    model.globalSettings.stunServers = this.DEFAULT_STUN_SERVERS;
    core.updateGlobalSettings(model.globalSettings);
    if(!this.$.confirmNewServer.hidden) {
      this.$.confirmNewServer.hidden = true;
    }
    this.$.confirmResetServers.hidden = false;
  },
  openFeedbackForm: function() {
    ui.view = UI.View.FEEDBACK;
  },
  ready: function() {
    this.ui = ui;
  }
});
