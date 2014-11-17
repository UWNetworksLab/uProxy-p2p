/**
 * Script for the introductory splash screen.
 */
console.log('top of splash.ts')
Polymer({
  SPLASH_STATES: {
    INTRO: 0,
    DESCRIPTION: 1,
    GET_OR_SHARE: 2,
    NETWORKS: 3
  },
  TOTAL_NUM_STATES: 4,
  networks: model.networks,
  ui: ui,
  setState: function(state) {
    if (state < 0 || state > this.TOTAL_NUM_STATES) {
      console.error('Invalid call to setState: ' + state);
      return;
    }
    ui.splashState = state;
    if (this.SPLASH_STATES.DESCRIPTION == ui.splashState) {
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

console.log('end of splash.ts')