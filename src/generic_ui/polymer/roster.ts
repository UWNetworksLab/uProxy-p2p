/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  model: model,
  loadingContacts: false,
  searchQuery: '',
  ready: function() {
    console.log('initializing roster');

    this.ui = ui;
    this.uProxy = uProxy;

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
    // If no contacts have loaded, show the animation for a total of 5 seconds,
    // and then display the "no online friends" message.
    if (!model.onlineNetwork.hasContacts) {
      this.loadingContacts = true;
      setTimeout(function(){ this.loadingContacts = false; }.bind(this), 5000);
    }
  }
});
