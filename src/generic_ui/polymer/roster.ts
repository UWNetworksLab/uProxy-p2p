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
    if (!ui_context.model.onlineNetwork.hasContacts) {
      this.loadingContacts = true;
      setTimeout(function(){ this.loadingContacts = false; }.bind(this), 5000);
    }
  }
});
