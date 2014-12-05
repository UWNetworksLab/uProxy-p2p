Polymer({
  model: model,
  logOut: function() {
    core.logout({name: model.onlineNetwork.name,
                 userId: model.onlineNetwork.userId}).then(() => {
      ui.view = UI.View.SPLASH;
      ui.setOfflineIcon();
    });
  },
  ready: function() {
    this.ui = ui;
  }
});
