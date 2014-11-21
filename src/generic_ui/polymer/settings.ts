Polymer({
  advancedSettings: false,
  logOut: function() {
    core.logout({name: ui.onlineNetwork.name,
                 userId: ui.onlineNetwork.userId}).then(() => {
      ui.view = UI.View.NETWORKS;  // TODO: will this work not in a promise?
    });
  },
  toggleAdvancedSettings: function() {
    this.advancedSettings = !this.advancedSettings;
  },
  setStunServer: function() {
    console.log(this.customStunServer);
    core.setStunServer({networkInfo:
                          {name: ui.onlineNetwork.name,
                           userId: ui.onlineNetwork.userId},
                        server: this.customStunServer});
  },
  ready: function() {
    this.ui = ui;
  }
});
