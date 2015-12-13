/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import ui_constants = require('../../interfaces/ui');
var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  acceptInvitation: function() {
    ui.handleInvite(this.receivedInviteToken).then(() => {
      ui.showDialog('', ui.i18n_t('FRIEND_ADDED'));
      this.closeAcceptUserInvitePanel();
    }).catch(() => {
      ui.showDialog('', ui.i18n_t('FRIEND_ADD_ERROR'));
    });
  },
  openAcceptUserInvitePanel: function() {
    this.$.acceptUserInvitePanel.open();
  },
  closeAcceptUserInvitePanel: function() {
    this.$.acceptUserInvitePanel.close();
  },
  showInviteUser: function() {
    this.fire('core-signal', { name: 'open-invite-user-dialog' });
    // accept-user-invite may be added on top of uproxy-invite-user, so
    // we need to close this panel.
    this.closeAcceptUserInvitePanel();
  },
  ready: function() {
    this.receivedInviteToken = '';
    this.model = model;
  }
});
