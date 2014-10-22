Polymer({
  expanded: false,
  contact: {
    // Must adhere to the typescript interface UI.User.
    name: 'unknown',
    pic: undefined
  },
  toggle: function() {
    if (this.contact.instances.length == 0) {
      this.expanded = false;
    } else {
      this.expanded = !this.expanded;
    }
    console.log('toggle', this);
  },
  collapse: function() {
    this.expanded = false;
    console.log('collapse', this);
  },
  ready: function() {
    if (!this.contact.pic) {
      this.contact.pic = '../icons/contact-default.png';
    }
  }
});
