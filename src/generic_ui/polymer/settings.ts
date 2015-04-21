/// <reference path='./context.d.ts' />

Polymer({
  DEFAULT_STUN_SERVERS: [
    {urls: ['stun:stun.services.mozilla.com']},
    {urls: ['stun:stun.stunprotocol.org']},
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    }
  ],
  displayAdvancedSettings: false,
  logOut: function() {
    browserified_exports.ui.logout({name: browserified_exports.model.onlineNetwork.name,
                                   userId: browserified_exports.model.onlineNetwork.userId}).then(() => {
      // Nothing to do here - the UI should receive a NETWORK update
      // saying that the network is offline, and will update the display
      // as result of that.
    }).catch((e :Error) => {
      console.error('logout returned error: ', e);
    });
  },
  restart: function() {
    browserified_exports.core.restart();
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
    browserified_exports.model.globalSettings.stunServers = [{urls: [this.stunServer]}];
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
    if(!this.$.confirmResetServers.hidden) {
      this.$.confirmResetServers.hidden = true;
    }
    this.$.confirmNewServer.hidden = false;
  },
  resetStunServers: function() {
    browserified_exports.model.globalSettings.stunServers = this.DEFAULT_STUN_SERVERS;
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
    if(!this.$.confirmNewServer.hidden) {
      this.$.confirmNewServer.hidden = true;
    }
    this.$.confirmResetServers.hidden = false;
  },
  openFeedbackForm: function() {
    this.fire('core-signal', {name: 'open-feedback'});
  },
  ready: function() {
    this.ui = browserified_exports.ui;
    this.model = browserified_exports.model;
  }
});
