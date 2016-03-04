/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;

const INSTALL_ARGS: uproxy_core_api.CloudInstallArgs = {
  providerName: 'digitalocean'
};

Polymer({
  openLoginDialog: function() {
    // TODO: Skip this if we're already logged into Digital Ocean.
    this.$.loginDialog.open();
  },
  closeDialogs: function() {
    this.$.loginDialog.close();
    this.$.installingDialog.close();
  },
  loginTapped: function() {
    this.$.loginDialog.close();
    this.$.installingDialog.open();
    ui.cloudInstall(INSTALL_ARGS).then((result: uproxy_core_api.CloudInstallResult) => {
      // TODO: Add the new server to the user's contact list.
      // TODO: Show the invite so the user can copy it so a safe place.
      ui.toastMessage = 'INVITE: ' + result.invite;
      this.closeDialogs();
    }).catch((e: Error) => {
      // TODO: Figure out which fields in e are set, because message isn't.
      ui.toastMessage = 'INSTALL FAILED';
      this.closeDialogs();
    })
  },
  ready: function() {
    this.ui = ui;
  }
});
