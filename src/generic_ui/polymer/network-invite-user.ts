/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import social = require('../../interfaces/social');

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  generateInviteUrl: function(networkName: string) {
    var selectedNetwork = model.getNetwork(networkName);
    return core.getInviteUrl({
      network: {
        name: selectedNetwork.name,
        userId: selectedNetwork.userId
      },
      isRequesting: this.requestAccess,
      isOffering: this.offerAccess
    }).then((inviteUrl:string) => {
      this.inviteUrl = inviteUrl;
      return selectedNetwork;
    });
  },
  sendToGMailFriend: function() {
    this.generateInviteUrl('GMail').then((selectedNetwork:any) => {
      var selectedNetworkInfo = {
        name: selectedNetwork.name,
        userId: selectedNetwork.userId
      };
      var name = selectedNetwork.userName || selectedNetwork.userId;
      var emailBody =
      core.sendEmail({
          networkInfo: selectedNetworkInfo,
          to: this.inviteUserEmail,
          subject: ui.i18n_t('INVITE_EMAIL_SUBJECT', { name: name }),
          body: ui.i18n_t('INVITE_EMAIL_BODY', { url: this.inviteUrl, name: name })
      });
      this.closeInviteUserPanel();
      ui.showDialog('', ui.i18n_t('INVITE_EMAIL_SENT'));
    });
  },
  inviteGithubFriend: function() {
    var selectedNetwork = model.getNetwork('GitHub');
    core.inviteUser({
      networkId: selectedNetwork.name,
      userName: this.userIdInput
    }).then(() => {
      this.closeInviteUserPanel();
      ui.showDialog('',
          ui.i18n_t('INVITE_SENT_CONFIRMATION', { name: this.userIdInput }));
    }).catch(() => {
      // TODO: The message in this dialog should be passed from the social provider.
      // https://github.com/uProxy/uproxy/issues/1923
      ui.showDialog('', ui.i18n_t('GITHUB_INVITE_SEND_FAILED'));
    });
  },
  openInviteUserPanel: function() {
    this.inviteUrl = '';
    this.offerAccess = false;
    this.requestAccess = false;
    if (this.network === 'Quiver') {
      this.generateInviteUrl('Quiver').then(() => {
        this.$.QuiverDialog.open();
      });
    } else {
      this.$.networkInviteUserPanel.open();
    }
  },
  closeInviteUserPanel: function() {
    this.$.networkInviteUserPanel.close();
    this.$.QuiverDialog.close();
  },
  select: function(e :Event, d :Object, input :HTMLInputElement) {
    input.focus();
    input.select();
  },
  ready: function() {
    this.inviteUrl = '';
    this.inviteUserEmail = '';
    this.model = model;
    this.userIdInput = '';
    this.offerAccess = false;
    this.requestAccess = false;
  }
});
