Polymer({
  model: {},
  ready: function() {

    // TODO: Use typescript and enums and everything here.
    this.ROSTER = 1;
    this.SETTINGS = 2;
    this.NETWORKS = 3;
    this.view = 0;  // this.ROSTER;
    var ui = this;
    var roster = this.$.roster;
    var settings = this.$.settings;
    console.log(roster);
    console.log(settings);

    // TODO: actually distinguish between give and get sort order.
    this.$.btnGive.addEventListener('clicked', function() {
      console.log('GIVE mode.');
      ui.view = ui.ROSTER;
    });
    this.$.btnGet.addEventListener('clicked', function() {
      console.log('GET mode.');
      ui.view = ui.ROSTER;
    });
    this.$.btnNetworks.addEventListener('click', function() {
      console.log('NETWORKS');
      ui.view = ui.NETWORKS;
    });
    this.$.btnSettings.addEventListener('clicked', function() {
      console.log('SETTINGS');
      // TODO: this is a hack for now. use actually good view state changes.
      ui.view = (ui.SETTINGS == ui.view) ? ui.ROSTER : ui.SETTINGS;
    });

  }
});
