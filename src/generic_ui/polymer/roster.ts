/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
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

    // Contacts offering you access or requesting access from you are only defined in
    // the get and share tabs respectively. Initialize the values here.
    if (this.contacts.onlineOfferingYouAccess &&
        this.contacts.offlineOfferingYouAccess) {
      this.onlineOfferingYouAccess = this.contacts.onlineOfferingYouAccess;
      this.offlineOfferingYouAccess = this.contacts.offlineOfferingYouAccess;
      // Friends requesting access are not shown in the get tab.
      this.onlineRequestingAccessFromYou = [];
      this.offlineRequestingAccessFromYou = [];
    } else if (this.contacts.onlineRequestingAccessFromYou &&
        this.contacts.offlineRequestingAccessFromYou) {
      this.onlineRequestingAccessFromYou = this.contacts.onlineRequestingAccessFromYou;
      this.offlineRequestingAccessFromYou = this.contacts.offlineRequestingAccessFromYou;
      // Friends offering access are not shown in the share tab.
      this.onlineOfferingYouAccess = [];
      this.offlineOfferingYouAccess = [];
    }

    this.onlineTrustedUproxyContacts = this.contacts.onlineTrustedUproxy;
    this.offlineTrustedUproxyContacts = this.contacts.offlineTrustedUproxy;
    this.onlineUntrustedUproxyContacts = this.contacts.onlineUntrustedUproxy;
    this.offlineUntrustedUproxyContacts = this.contacts.offlineUntrustedUproxy;
    this.onlineNonUproxyContacts = this.contacts.onlineNonUproxy;
    this.offlineNonUproxyContacts = this.contacts.offlineNonUproxy;
  },
  searchQuery: ''
});
