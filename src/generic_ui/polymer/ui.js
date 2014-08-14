Polymer({
  model: {},
  ready: function() {
    // TODO: Use typescript and enums and everything here.
    this.ROSTER = 1;
    this.SETTINGS = 2;
    this.view = this.ROSTER;
    var ui = this;
    var roster = this.$.roster;
    var settings = this.$.settings;
    console.log(roster);
    console.log(settings);
    this.$.btnGive.addEventListener('clicked', function() {
      console.log('GIVE mode.');
    });
    this.$.btnGet.addEventListener('clicked', function() {
      console.log('GET mode.');
    });
    this.$.btnSettings.addEventListener('clicked', function() {
      console.log('SETTINGS');
      // TODO: this is a hack for now. use actually good view state changes.
      ui.view = (ui.SETTINGS == ui.view) ? ui.ROSTER : ui.SETTINGS;
    });
  }
});
