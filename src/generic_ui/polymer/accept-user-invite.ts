/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  acceptInvitation: function() {
    var token = this.receivedInviteToken.lastIndexOf('/') >= 0 ?
    this.receivedInviteToken.substr(this.receivedInviteToken.lastIndexOf('/') + 1) : this.receivedInviteToken;
    var tokenObj = JSON.parse(atob(token));
    var networkName = tokenObj.networkName;
    var networkData = tokenObj.networkData;
    var userId = JSON.parse(networkData)['userId'];

    var path = {
      network : {
       name: networkName,
       userId: ""
      },
      userId: userId
    };

    core.acceptInvitation({userPath: path, data: networkData}).then(() => {
      this.fire('open-dialog', {
        heading: 'Friend Added', // TODO: translate
        message: '',  // TODO:
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
      this.closeAcceptUserInvitePanel();
    }).catch(() => {
      this.fire('open-dialog', {
        heading: '', // TODO: translate
        message: 'There was an error adding your friend.',  // TODO:
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
      console.log('There was an error adding your friend.');
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
