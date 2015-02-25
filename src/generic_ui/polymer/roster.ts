/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  model: model,
  finishedSearchingForContacts: false,
  isEmpty: function(onlineTrustedUproxyContacts,
                    offlineTrustedUproxyContacts,
                    onlinePending,
                    offlinePending,
                    onlineUntrustedUproxyContacts,
                    offlineUntrustedUproxyContacts)) {
    if (this.onlineUntrustedUproxyContacts.length +
        this.offlineUntrustedUproxyContacts.length +
        this.onlineTrustedUproxyContacts.length +
        this.offlineTrustedUproxyContacts.length +
        this.onlinePending.length +
        this.offlinePending.length == 0) {
      this.searchForContacts();
      return true;
    }
  },
  searchForContacts: function() {

  }
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
  },
  searchQuery: ''
});
