/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  model: model,
  onlineTrustedUproxyContacts: model.contacts.onlineTrustedUproxy,
  offlineTrustedUproxyContacts: model.contacts.offlineTrustedUproxy,
  onlineUntrustedUproxyContacts: model.contacts.onlineUntrustedUproxy,
  offlineUntrustedUproxyContacts: model.contacts.offlineUntrustedUproxy,
  onlineNonUproxyContacts: model.contacts.onlineNonUproxy,
  offlineNonUproxyContacts: model.contacts.offlineNonUproxy,
  toggleSharing: function() {
    model.globalSettings.sharing = !this.model.globalSettings.sharing;
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
  },
  searchQuery: ''
});
