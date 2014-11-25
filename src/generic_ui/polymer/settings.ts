Polymer({
  advancedSettings: false,
  logOut: function() {
    core.logout({name: ui.onlineNetwork.name,
                 userId: ui.onlineNetwork.userId}).then(() => {
      ui.view = UI.View.SPLASH;
    });
  },
  toggleAdvancedSettings: function() {
    this.advancedSettings = !this.advancedSettings;
  },
  setStunServer: function() {
    core.setStunServer(this.stunServer);
    this.$.confirmNewServer.hidden = false;
  },
  ready: function() {
    this.ui = ui;
  }
});
