/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />
/// <reference path='./context.d.ts' />

import ui_constants = require('../../interfaces/ui');

Polymer({
  connect: function() {
    ui_context.ui.login(this.networkName).then(() => {
      console.log('connected to ' + this.networkName);
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', {view: ui_constants.View.ROSTER});
      ui_context.ui.bringUproxyToFront();
    }).catch((e :Error) => {
      ui_context.ui.showNotification('There was a problem signing in to ' + this.networkName + '.  Please try again.');
      console.warn('Did not log in ', e);
    });
  },
  ready: function() {},
});
