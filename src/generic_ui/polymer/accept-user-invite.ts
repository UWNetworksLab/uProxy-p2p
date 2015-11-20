/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import ui_constants = require('../../interfaces/ui');
var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  acceptInvitation: function() {
    var token = this.receivedInviteToken.lastIndexOf('/') >= 0 ?
    this.receivedInviteToken.substr(this.receivedInviteToken.lastIndexOf('/') + 1) : this.receivedInviteToken;
    var tokenObj = JSON.parse(atob(token));
    var networkName = tokenObj.networkName;

    var confirmLogin = Promise.resolve<void>();
    if (networkName === "Cloud") {
      // Inform the user that their invite code will connect them to our Cloud
      // social provider.
      // TODO: Remove this when we fully launch Cloud.
      var confirmationMessage = ui.i18n_t("CLOUD_INVITE_CONFIRM");
      confirmLogin = ui.getConfirmation('', confirmationMessage).then(() => {
        // Set mode to GET, as Cloud friends only appear in the GET tab.
        ui.setMode(ui_constants.Mode.GET);
        return ui.login("Cloud").catch((e :Error) => {
          console.warn('Error logging into Cloud', e);
        });
      }).catch(() => {
        console.log("Cloud login declined");
        return;
      });
    }

    var socialNetworkInfo = {
      name: networkName,
      userId: "" /* The current user's ID will be determined by the core. */
    };

    confirmLogin.then(() => {
      core.acceptInvitation({network: socialNetworkInfo, token: this.receivedInviteToken})
          .then(() => {
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
