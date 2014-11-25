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
  setSocksRtcStunServer: function() {
    core.setStunServer({networkInfo: {
                              name: ui.onlineNetwork.name,
                              userId: ui.onlineNetwork.userId
                              },
                            socksRtcStunServer: this.socksRtcStunServer
                            });
    this.$.confirmNewServer.hidden = false;
  },
  setRtcNetStunServer: function() {
    core.setStunServer({networkInfo: {
                              name: ui.onlineNetwork.name,
                              userId: ui.onlineNetwork.userId
                              },
                            rtcNetStunServer: this.rtcNetStunServer
                            });
    this.$.confirmNewServer.hidden = false;
  },
  ready: function() {
    this.ui = ui;
  }
});
