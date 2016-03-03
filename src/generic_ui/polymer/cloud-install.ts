/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;

const DEPLOY_ARGS: uproxy_core_api.DeployCloudServerArgs = {
  providerName: 'digitalocean'
};

Polymer({
  runWizard: function() {
    // TODO: Skip this if we're already logged into Digital Ocean.
    this.$.loginDialog.open();
  },
  closeWizard: function() {
    this.$.loginDialog.close();
    this.$.installingDialog.close();
  },
  loginTapped: function() {
    this.$.loginDialog.close();
    this.$.installingDialog.open();
    ui.deployCloudServer(DEPLOY_ARGS).then((serverInfo: uproxy_core_api.CloudInstallArgs) => {
      return ui.cloudInstall(serverInfo);
    }).then((invite: string) => {
      // TODO: Add the new server to the user's contact list.
      // TODO: Show the invite so the user can copy it so a safe place.
      ui.toastMessage = 'INVITE: ' + invite;
      this.closeWizard();
    }).catch((e: Error) => {
      // TODO: Figure out which fields in e are set, because message isn't.
      ui.toastMessage = 'INSTALL FAILED';
      this.closeWizard();
    })
  },
  ready: function() {
    this.ui = ui;
  }
});
