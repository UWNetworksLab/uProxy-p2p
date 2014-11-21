/**
 * Script for the introductory splash screen.
 */
Polymer({
  SPLASH_STATES: {
    INTRO: 0,
    DESCRIPTION: 1,
    GET_OR_SHARE: 2,
    NETWORKS: 3
  },
  networks: model.networks,
  ui: ui,
  setState: function(state) {
    if (state < 0 || state > Object.keys(this.SPLASH_STATES).length) {
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
  setGetMode: function() {
    ui.mode = UI.Mode.GET;
    this.next();
  },
  setShareMode: function() {
    ui.mode = UI.Mode.SHARE;
    this.next();
  },
  ready: function() {}
});
