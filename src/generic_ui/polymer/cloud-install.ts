/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;

var install_args: uproxy_core_api.CloudInstallArgs = {
  providerName: 'digitalocean',
  region: ''
};

Polymer({
  openLoginDialog: function() {
    this.$.loginDialog.open();
  },
  closeDialogs: function() {
    this.$.loginDialog.close();
    this.$.installingDialog.close();
    this.$.successDialog.close();
    this.$.failureDialog.close();
  },
  loginTapped: function() {
    install_args.region = this.$.regionMenu.selected;
    this.closeDialogs();
    // TODO: show the dialog when this value changes, not this nasty hack
    ui.cloudInstallStatus = '';
    this.$.installingDialog.open();

    ui.cloudInstall(install_args).then((result: uproxy_core_api.CloudInstallResult) => {
      this.inviteUrl = result.invite;
      this.closeDialogs();
      this.$.successDialog.open();

      // TODO: In addition to displaying the URL so the user can store it somewhere
      //       we should add the new server to the user's contact list.
    }).catch((e: Error) => {
      // TODO: Figure out which fields in e are set, because message isn't.
      this.closeDialogs();
      this.$.failureDialog.open();
    })
  },
  select: function(e: Event, d: Object, input: HTMLInputElement) {
    input.focus();
    input.select();
  },
  ready: function() {
    this.ui = ui;
    this.inviteUrl = '';
  }
});
