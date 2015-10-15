/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

Polymer({
  close: function() {
    this.$.faqPanel.close();
  },
  open: function() {
    this.$.faqPanel.open();
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  }
});