/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :uProxy.UIAPI;

Polymer({
  model: {},
  // TODO: actually distinguish between give and get sort order.
  giveMode: function() {
    console.log('GIVE mode.');
    ui['view'] = UI.View.ROSTER;
    // TODO(keroserene): Update the original UI file and this new polymer UI
    // file, merge them, clean out the old, apply the new.
    ui['gestalt'] = UI.Gestalt.GIVING;
  },
  // TODO: These might actually belong in the generic ui.ts
  getMode: function() {
    console.log('GET mode.');
    ui['view'] = UI.View.ROSTER;
    ui['gestalt'] = UI.Gestalt.GETTING;
  },
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

    ui['gestalt'] = UI.Gestalt.GIVING;
    this.loggedIn = ui['loggedIn'];

    // if (ui['introSplashed']) {
      // This must be asynchronous to avoid a CSS bug.
      // TODO: There seems to be a race condition with polymer element load
      // order which sometimes still causes a CSS bug. This needs to be fixed.
      // this.async(function() {
        // ui['view'] = UI.View.NETWORKS;
      // }, 1000);
    // }
  }
});
