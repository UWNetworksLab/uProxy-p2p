/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import ui_constants = require('../../interfaces/ui');

Polymer({
  loadingContacts: false,
  searchQuery: '',
  ready: function() {
    console.log('initializing roster');

    this.ui = browserified_exports.ui;
    this.ui_constants = ui_constants;
    this.model = browserified_exports.model;
  },
  loadContacts: function() {
    // If no contacts have loaded, show the animation for a total of 5 seconds,
    // and then display the "no online friends" message.
    if (!browserified_exports.model.onlineNetwork.hasContacts) {
      this.loadingContacts = true;
      setTimeout(function(){ this.loadingContacts = false; }.bind(this), 5000);
    }
  }
});
