/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  addUser: function() {
    core.addUser(this.receivedInviteToken).then(() => {
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t("FRIEND_ADDED"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
      this.closeAcceptUserInvitePanel();
    }).catch(() => {
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t("FRIEND_ADD_ERROR"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
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
  }
});
