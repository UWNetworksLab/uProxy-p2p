/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :UI.UserInterface;

Polymer({
  model: model,
  updateView: function(e, detail, sender) {
    // If we're switching from the SPLASH page to the ROSTER, fire an
    // event indicating the user has logged in. roster.ts listens for
    // this event.
    if (detail.view == UI.View.ROSTER && ui['view'] == UI.View.SPLASH) {
      this.fire('core-signal', {name: "login-success"});
    }
    ui['view'] = detail.view;
  },
  settingsView: function() {
    ui['view'] = UI.View.SETTINGS;
  },
  rosterView: function() {
    console.log('rosterView called');
    ui['view'] = UI.View.ROSTER;
  },
  setGetMode: function() {
    ui.mode = UI.Mode.GET;
  },
  setShareMode: function() {
    ui.mode = UI.Mode.SHARE;
  },
  ready: function() {
    // Expose global ui object and UI module in this context.
    this.ui = ui;
    this.UI = UI;
  }
});
