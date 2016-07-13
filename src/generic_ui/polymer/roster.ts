/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import ui_constants = require('../../interfaces/ui');

Polymer({
  loadingContacts: false,
  ready: function() {
    console.log('initializing roster');

    this.ui = ui_context.ui;
    this.ui_constants = ui_constants;
    this.model = ui_context.model;
  },
  computed: {
    'hasGetContacts': '(model.contacts.getAccessContacts.pending.length + model.contacts.getAccessContacts.trustedUproxy.length + model.contacts.getAccessContacts.untrustedUproxy.length) > 0',
    'hasShareContacts': '(model.contacts.shareAccessContacts.pending.length + model.contacts.shareAccessContacts.trustedUproxy.length + model.contacts.shareAccessContacts.untrustedUproxy.length) > 0',
    'hasContacts': '(mode==ui_constants.Mode.GET && hasGetContacts) || (mode==ui_constants.Mode.SHARE && hasShareContacts)'
  },
});
