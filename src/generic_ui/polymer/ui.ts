/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :uProxy.UIAPI;

var $ui;
window['$ui'] = $ui;

Polymer({
  model: {},
  // TODO: actually disting$uish between give and get sort order.
  giveMode: () => {
    console.log('GIVE mode.');
    $ui.view = $ui.ROSTER;
    // TODO(keroserene): Update the original UI file and this new polymer UI
    // file, merge them, clean out the old, apply the new.
    ui['gestalt'] = UI.Gestalt.GIVING;
  },
  getMode: () => {
    console.log('GET mode.');
    $ui.view = $ui.ROSTER;
    ui['gestalt'] = UI.Gestalt.GETTING;
  },
  networksView: () => {
    console.log('NETWORKS');
    $ui.view = $ui.NETWORKS;
  },
  settingsView: () => {
    console.log('SETTINGS');
    // TODO: this is a hack for now. use actually good view state changes.
    $ui.view = ($ui.SETTINGS == $ui.view) ? $ui.ROSTER : $ui.SETTINGS;
  },
  ready: function() {

    // TODO: Use typescript and enums and everything here.
    this.SPLASH = 0;
    this.ROSTER = 1;
    this.SETTINGS = 2;
    this.NETWORKS = 3;

    console.log('UI view is doing a thing!', this.view);
    $ui = this;

    ui['gestalt'] = UI.Gestalt.GIVING;
    $ui.loggedIn = ui['loggedIn'];

    // Determine which view to start in.
    this.view = this.SPLASH;
    if (ui['introSplashed']) {
      // This must be asynchronous to avoid a CSS bug.
      // TODO: There seems to be a race condition with polymer element load
      // order which sometimes still causes a CSS bug. This needs to be fixed.
      this.async(function() {
        this.view = this.NETWORKS;
      }, 1000);
    }

  }
});
