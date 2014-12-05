/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  toggleSharing: function() {
    core.updateGlobalSettings(model.globalSettings);
  },
  ready: function() {
    console.log('initializing roster');
    // this.contacts.push({
      // name: 'alice',
      // description: 'just some laptop'
    // });
    // this.contacts.push({ name: 'bob' });
    // this.contacts.push({ name: 'charlie' });
    // this.contacts.push({ name: 'dave' });
    // this.contacts.push({ name: 'eve' });

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
    this.onlineNonUproxyContacts = this.contacts.onlineNonUproxy;
    this.offlineNonUproxyContacts = this.contacts.offlineNonUproxy;

  },
  searchQuery: ''
});
