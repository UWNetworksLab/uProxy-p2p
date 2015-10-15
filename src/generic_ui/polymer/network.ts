/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='./context.d.ts' />

import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  connect: function() {
    // TODO: clean this up, make generic!
    if (this.networkName == 'Quiver') {
      this.fire('core-signal', {name: 'show-quiver-login'});
      return;
    }

    ui.login(this.networkName).then(() => {
      console.log('connected to ' + this.networkName);
      // syncNetwork will update the view to the ROSTER.
      ui.bringUproxyToFront();
    }).catch((e :Error) => {
      console.warn('Did not log in ', e);
    });
  },
  ready: function() {
    this.displayName = ui.getNetworkDisplayName(this.networkName);
    this.isExperimental = ui.isExperimentalNetwork(this.networkName);
  },
});
