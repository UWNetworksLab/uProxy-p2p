Polymer({
  logout: function() {
    ui.stopReconnect();
    ui.view = uProxy.View.SPLASH;
  },
  ready: function() {
    this.model = model;
  }
});
