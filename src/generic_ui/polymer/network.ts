/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />
/// <reference path='./context.d.ts' />

import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  connect: function() {
    ui.login(this.networkName).then(() => {
      console.log('connected to ' + this.networkName);
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', {view: ui_constants.View.ROSTER});
      ui.bringUproxyToFront();
    }).catch((e :Error) => {
      ui.showNotification(ui.i18n_t('errorSigningIn', {network: this.networkName}));
      console.warn('Did not log in ', e);
    });
  },
  ready: function() {},
});
