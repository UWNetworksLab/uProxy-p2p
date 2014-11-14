/**
 * Script for the introductory splash screen.
 */
var DESCRIPTION_STATE = 1;
var NETWORKS_STATE = 3;
Polymer({
  networks: model.networks,
  state: 0,
  next: function() {
    if (NETWORKS_STATE == this.state) {
      console.error('ignoring next click from network page');
      return;
    }
    this.state++;
    if (DESCRIPTION_STATE == this.state) {
      var desc = this.$.description.children[1];
      desc.$['device-name'].focus();
    }
  },
  ready: function() {}
});
