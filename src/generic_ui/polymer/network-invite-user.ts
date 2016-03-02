/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import social = require('../../interfaces/social');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  generateInviteUrl: function(networkName: string) {
    var selectedNetwork = model.getNetwork(networkName);
    var CreateInviteArgs :uproxy_core_api.CreateInviteArgs = {
      network: {
        name: selectedNetwork.name,
        userId: selectedNetwork.userId
      },
      isLocalRequesting: this.requestAccess,
      isLocalOffering: this.offerAccess
    };
    return core.getInviteUrl(CreateInviteArgs).then((inviteUrl:string) => {
      this.inviteUrl = inviteUrl;
      return selectedNetwork;
    });
  },
  sendToFacebookFriend: function() {
    this.generateInviteUrl('Facebook-Firebase-V2').then(() => {
      var facebookUrl =
          'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link='
          + this.inviteUrl + '&redirect_uri=https://www.uproxy.org/';
      ui.openTab(facebookUrl);
      this.closeInviteUserPanel();
      // TODO: remove this (and translation label)?
      // ui.showDialog('', ui.i18n_t('FACEBOOK_INVITE_IN_BROWSER'));
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
    core.inviteGitHubUser({
      network: {
        name: selectedNetwork.name,
        userId: selectedNetwork.userId
      },
      isRequesting: this.requestAccess,
      isOffering: this.offerAccess,
      userId: this.userIdInput
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
    this.quiverInviteMessage = '';
    if (this.network === 'Quiver') {
      this.generateInviteUrl('Quiver').then(() => {
        this.$.networkInviteUserPanel.open();
      });
    } else {
      this.$.networkInviteUserPanel.open();
    }
  },
  closeInviteUserPanel: function() {
    this.$.networkInviteUserPanel.close();
  },
  selectQuiverInvite: function(e :Event, d :Object, input :HTMLInputElement) {
    input.focus();
    input.select();
    this.quiverInviteMessage = '';
  },
  updateQuiverInvite: function() {
    this.generateInviteUrl('Quiver');
    this.quiverInviteMessage = 'Invite URL has changed, please be sure to copy the last invitation';  // TODO: translate
  },
  ready: function() {
    this.inviteUrl = '';
    this.inviteUserEmail = '';
    this.model = model;
    this.userIdInput = '';
    this.quiverInviteMessage = '';
    this.offerAccess = false;
    this.requestAccess = false;
  }
});
