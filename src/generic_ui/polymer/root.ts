/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :UI.UserInterface;

Polymer({
  model: {},
  networksView: function() {
    console.log('NETWORKS');
    ui['view'] = UI.View.NETWORKS;
  },
  settingsView: function() {
    console.log('SETTINGS');
    // TODO: this is a hack for now. use actually good view state changes.
    ui['view'] = (UI.View.SETTINGS == ui['view']) ?
        UI.View.ROSTER : UI.View.SETTINGS;
  },
  ready: function() {
    // Expose global ui object and UI module in this context.
    this.ui = ui;
    this.UI = UI;

    this.loggedIn = ui['loggedIn'];
  }
});
