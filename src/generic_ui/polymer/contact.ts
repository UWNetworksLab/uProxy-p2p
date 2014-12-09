Polymer({
  contact: {
    // Must adhere to the typescript interface UI.User.
    name: 'unknown',
    pic: undefined,
    expanded: false
  },
  toggle: function() {
    if (this.contact.instances.length == 0) {
      this.contact.expanded = false;
    } else {
      this.contact.expanded = !this.contact.expanded;
    }
    console.log('toggle', this.contact.expanded);
  },
  collapse: function() {
    this.contact.expanded = false;
    console.log('collapse', this.contact.expanded);
  },
  ready: function() {
    if (!this.contact.pic) {
      this.contact.pic = '../icons/contact-default.png';
    }
  },

  getShortenedContact: function() {
    // The integer below is the cutoff length for contact names. 
    // If it is longer than 30 it will be truncated
    if (this.contact.name.length > 30) {
      return this.contact.name.substring(0,8) + '...';
    }
    return this.contact.name;
  }
  
});
