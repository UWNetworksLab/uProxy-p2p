/**
 * Script for the introductory splash screen.
 */
var DESCRIPTION_STATE = 2;
var NUM_STATES = 3;
Polymer({
  state: 0,
  next: function() {
    this.state++;
    if (DESCRIPTION_STATE == this.state) {
      var desc = this.$.description.children[1];
      desc.$['device-name'].focus();
    } else if (this.state >= NUM_STATES) {
      this.end();
    }
  },
  end: function() {
    console.log('closing the splash intro.');
    ui['view'] = UI.View.NETWORKS;
  },
  ready: function() {}
});
