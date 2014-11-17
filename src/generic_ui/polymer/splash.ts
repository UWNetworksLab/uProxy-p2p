/**
 * Script for the introductory splash screen.
 */
var DESCRIPTION_STATE = 1;
var TOTAL_NUM_STATES = 4;
Polymer({
  networks: model.networks,
  ui: ui,
  setState: function(state) {
    if (state < 0 || state > TOTAL_NUM_STATES) {
      console.error('Invalid call to setState: ' + state);
      return;
    }
    ui.splashState = state;
    if (DESCRIPTION_STATE == ui.splashState) {
      var desc = this.$.description.children[0].children[1];
      desc.$['device-name'].focus();
    }
  },
  next: function() {
    this.setState(ui.splashState + 1);
  },
  prev: function() {
    this.setState(ui.splashState - 1);
  },
  ready: function() {}
});
