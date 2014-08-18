Polymer({
  model: {},
  ready: function() {

    // TODO: Use typescript and enums and everything here.
    this.ROSTER = 1;
    this.SETTINGS = 2;
    this.NETWORKS = 3;

    this.GIVING = 101;
    this.GETTING = 102;

    this.view = 0;  // this.ROSTER;
    var ui = this;
    var roster = this.$.roster;
    var settings = this.$.settings;
    console.log(roster);
    console.log(settings);

    ui.gestalt = this.GIVING;

    // TODO: actually distinguish between give and get sort order.
    this.$.btnGive.addEventListener('clicked', function() {
      console.log('GIVE mode.');
      ui.view = ui.ROSTER;
      ui.gestalt = ui.GIVING;
    });
    this.$.btnGet.addEventListener('clicked', function() {
      console.log('GET mode.');
      ui.view = ui.ROSTER;
      ui.gestalt = ui.GETTING;
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
