/**
 * Script for the introductory splash screen.
 */
Polymer({
  state: 0,
  next: function() {
    this.state++;
    if (1 == this.state) {
      var desc = this.$.description.children[1];
      desc.$['device-name'].focus();
    } else if (this.state >= 2) {
      this.end();
    }
  },
  end: function() {
    console.log('closing the splash intro.');
    ui['introSplashed'] = true;
    // var $ui = this.parentNode.host;
    // console.log($ui);
    ui['view'] = UI.View.NETWORKS;
  },
  ready: function() {
  }
});
