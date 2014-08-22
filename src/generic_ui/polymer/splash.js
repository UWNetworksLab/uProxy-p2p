Polymer({
  currentView: 0,
  next: function() {
    this.currentView++;
    var ui = this.parentNode.host;
    console.log(ui);
    if (this.currentView >= 2) {
      ui.view = ui.NETWORKS;
    }
  },
  ready: function() {
    console.log('splash is ready');
  }
});
