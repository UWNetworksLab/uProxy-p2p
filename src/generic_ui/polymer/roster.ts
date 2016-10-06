/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />

import * as ui_constants from '../../interfaces/ui';

Polymer({
  ready: function() {
    this.ui_constants = ui_constants;
  },
  computed: {
    'hasContacts': '(contacts.pending.length + contacts.trustedUproxy.length + contacts.untrustedUproxy.length) > 0'
  },
});
