Polymer({
  displayAdvancedSettings: false,
  logOut: function() {
    core.logout({name: ui.onlineNetwork.name,
                 userId: ui.onlineNetwork.userId}).then(() => {
      ui.view = UI.View.SPLASH;
    });
  },
  toggleAdvancedSettings: function() {
    this.displayAdvancedSettings = !this.displayAdvancedSettings;
  },
  setStunServer: function() {
    core.setStunServer(this.stunServer);
    this.$.confirmNewServer.hidden = false;
  },
  ready: function() {
    this.ui = ui;
  }
});
