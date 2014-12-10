/**
 * Script for the introductory splash screen.
 */
Polymer({
  SPLASH_STATES: {
    INTRO: 0,
    GET_OR_SHARE: 1,
    NETWORKS: 2
  },
  networkNames: model.networkNames,
  ui: ui,
  setState: function(state) {
    if (state < 0 || state > Object.keys(this.SPLASH_STATES).length) {
      console.error('Invalid call to setState: ' + state);
      return;
    }
    ui.splashState = state;
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
