/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  loadingContacts: false,
  searchQuery: '',
  onlinePending: [],
  offlinePending: [],
  onlineTrustedUproxyContacts: [],
  offlineTrustedUproxyContacts: [],
  onlineUntrustedUproxyContacts: [],
  offlineUntrustedUproxyContacts: [],
  ready: function() {
    console.log('initializing roster');

    this.ui = ui;
    this.uProxy = uProxy;
    this.model = model;
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
