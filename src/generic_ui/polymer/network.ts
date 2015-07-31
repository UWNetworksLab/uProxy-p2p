/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='./context.d.ts' />

import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  connect: function() {
    // TODO: clean this up, make generic!
    // also make this work if you click Email connect in Settings (for multiple social networks)
    if (this.networkName == 'Email') {
      this.fire('core-signal', {name: 'show-email-login'});
      return;
    }

    ui.login(this.networkName).then(() => {
      console.log('connected to ' + this.networkName);
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', { view: ui_constants.View.ROSTER });
      ui.bringUproxyToFront();
    }).catch((e :Error) => {
      console.warn('Did not log in ', e);
    });
  },
  ready: function() {},
});
