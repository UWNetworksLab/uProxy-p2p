Polymer({
  expanded: false,
  contact: {
    // Must adhere to the typescript interface.
    name: 'unknown',
    pic: undefined,
    description: 'description here'
  },
  toggle: function() {
    this.expanded = !this.expanded;
    console.log('toggle', this);
  },
  collapse: function() {
    this.expanded = false;
    console.log('collapse', this);
  },
  getting: function() {
    var roster = this.parentNode.host;
    console.log(roster);
    if (!roster) {
      return false;
    }
    var ui = roster.parentNode.host;
    return ui.GETTING == ui.gestalt;
  },
  ready: function() {
    if (!this.contact.pic) {
      this.contact.pic = '../icons/contact-default.png';
    }
    if (!this.contact.description) {
      this.contact.description = 'no description.';
    }
  }
});
