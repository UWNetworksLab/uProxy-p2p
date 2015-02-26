/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  model: model,
  loadingContacts: false,
  searchQuery: '',
  onlineTrustedUproxyContacts: [],
  offlineTrustedUproxyContacts: [],
  onlinePending: [],
  offlinePending: [],
  onlineUntrustedUproxyContacts: [],
  offlineUntrustedUproxyContacts: [],
  ready: function() {
    console.log('initializing roster');

    this.ui = ui;
    this.UI = UI;

    // Initialize roster here.
    // this.contacts contains either all the contact groups for the get tab
    // or all the contact groups for the share tab.
    this.onlinePending = this.contacts.onlinePending;
    this.offlinePending = this.contacts.offlinePending;
    this.onlineTrustedUproxyContacts = this.contacts.onlineTrustedUproxy;
    this.offlineTrustedUproxyContacts = this.contacts.offlineTrustedUproxy;
    this.onlineUntrustedUproxyContacts = this.contacts.onlineUntrustedUproxy;
    this.offlineUntrustedUproxyContacts = this.contacts.offlineUntrustedUproxy;
  },
  loadContacts: function() {
    this.loadingContacts = true;
    // Show the loading contacts page for at least 1.5 seconds. In this
    // time, if contacts load, transition directly to the roster.
    // If no contacts have loaded, show the animation for a total of 5 seconds,
    // and then display the "no online friends" message.
    setTimeout(function(){
      var numberOfContacts = this.onlinePending.length +
                   this.offlinePending.length +
                   this.onlineTrustedUproxyContacts.length +
                   this.offlineTrustedUproxyContacts.length +
                   this.onlineUntrustedUproxyContacts.length +
                   this.offlineUntrustedUproxyContacts.length;
      if (numberOfContacts == 0) {
        setTimeout(function(){ this.loadingContacts = false; }.bind(this), 5000);
      } else {
        this.loadingContacts = false;
      }
    }.bind(this), 1500);
  }
});
