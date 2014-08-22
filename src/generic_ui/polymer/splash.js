Polymer({
  currentView: 0,
  next: function() {
    this.currentView++;
    var ui = this.parentNode.host;
    console.log(ui);
    if (1 == this.currentView) {
      var desc = this.$.description.children[1];
      desc.$['device-name'].focus();
    }
    if (this.currentView >= 2) {
      ui.view = ui.NETWORKS;
    }
  },
  ready: function() {
    console.log('splash is ready');
  }
});
