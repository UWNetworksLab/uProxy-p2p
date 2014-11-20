Polymer({
  logOut: function() {
    core.logout({name: ui.onlineNetwork.name,
                 userId: ui.onlineNetwork.userId}).then(() => {
      ui.view = UI.View.SPLASH;
      ui.logoutInUi();
    });
  },
  ready: function() {
    this.ui = ui;
  }
});
