/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import ui_constants = require('../../interfaces/ui');

Polymer({
  loadingContacts: false,
  searchQuery: '',
  ready: function() {
    console.log('initializing roster');

    this.ui = ui_context.ui;
    this.ui_constants = ui_constants;
    this.model = ui_context.model;
  },
  loadContacts: function() {
    // If no contacts have loaded, show the animation for a total of 5 seconds,
    // and then display the "no online friends" message.
    if (!this.hasContacts) {
      this.loadingContacts = true;
      setTimeout(function(){ this.loadingContacts = false; }.bind(this), 5000);
    }
  },
  computed: {
    'hasContacts': '(model.contacts.getAccessContacts.pending.length + model.contacts.getAccessContacts.trustedUproxy.length + model.contacts.getAccessContacts.untrustedUproxy.length + model.contacts.shareAccessContacts.pending.length + model.contacts.shareAccessContacts.trustedUproxy.length + model.contacts.shareAccessContacts.untrustedUproxy.length) > 0',
  },
});
