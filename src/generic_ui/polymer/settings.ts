Polymer({
  logOut: function() {
    core.logout({name: ui.onlineNetwork.name,
                 userId: ui.onlineNetwork.userId}).then(() => {
      ui.view = UI.View.NETWORKS;  // TODO: will this work not in a promise?
    });
  },
  ready: function() {
    this.ui = ui;
  }
});
