/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import user_interface = require('../scripts/ui');
import loginCommon = require('./login-common');
import _ = require('lodash');
var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

var inviteUser = {
  generateInviteUrl: function(name :string) {
    var network = model.getNetwork(name);
    var networkInfo = { name: network.name, userId: network.userId };
    return core.getInviteUrl(networkInfo);
  },
  sendToGMailFriend: function() {
    var network = model.getNetwork('GMail');
    this.generateInviteUrl('GMail').then((inviteUrl :string) => {
      var userName = network.userName || network.userId;
      var emailBody = core.sendEmail({
          networkInfo: {name: network.name, userId: network.userId},
          to: this.inviteUserEmail,
          subject: ui.i18n_t('INVITE_EMAIL_SUBJECT', { name: userName }),
          body: ui.i18n_t('INVITE_EMAIL_BODY', { url: inviteUrl, name: userName })
      });
      this.closeInviteUserPanel();
      ui.showDialog('', ui.i18n_t('INVITE_EMAIL_SENT'));
    });
  },
  sendToFacebookFriend: function() {
    this.generateInviteUrl('Facebook-Firebase-V2').then((inviteUrl :string) => {
      var facebookUrl =
          'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link='
          + inviteUrl + '&redirect_uri=https://www.uproxy.org/';
      ui.openTab(facebookUrl);
      this.closeInviteUserPanel();
      ui.showDialog('', ui.i18n_t('FACEBOOK_INVITE_IN_BROWSER'));
    });
  },
  inviteGithubFriend: function() {
    core.inviteUser({
      networkId: 'GitHub',
      userName: this.githubUserIdInput
    }).then(() => {
      this.closeInviteUserPanel();
      ui.showDialog('', ui.i18n_t('INVITE_SENT_CONFIRMATION', { name: this.githubUserIdInput }));
    }).catch(() => {
      // TODO: The message in this dialog should be passed from the social provider.
      // https://github.com/uProxy/uproxy/issues/1923
      this.closeInviteUserPanel();
      ui.showDialog('', ui.i18n_t('GITHUB_INVITE_SEND_FAILED'));
    });
  },
  onNetworkSelect: function(e :any, details :any) {
    if (details.isSelected) {
      this.selectedNetworkName = details.item.getAttribute('label');
    }
  },
  openInviteUserPanel: function() {
    this.setOnlineInviteNetworks();
    // Reset selectedNetworkName in case it had been set and that network
    // is no longer online.
    this.$.networkSelectMenu.selectIndex(0);

    // Reset the input, expectation is for it to be empty
    this.userName = model.globalSettings.quiverUserName;
    this.inviteUserEmail = '';
    this.githubUserIdInput = '';

    this.$.inviteUserPanel.open();
  },
  closeInviteUserPanel: function() {
    this.$.inviteUserPanel.close();
  },
  showAcceptUserInvite: function() {
    this.fire('core-signal', { name: 'open-accept-user-invite-dialog' });
    this.closeInviteUserPanel();
  },
  setOnlineInviteNetworks: function() {
    this.onlineInviteNetworks = [];
    for (var i = 0; i < model.onlineNetworks.length; ++i) {
      var name = model.onlineNetworks[i].name;
      this.onlineInviteNetworks.push({
        name: name,
        displayName: ui.getNetworkDisplayName(name)
      });
    }
  },
  /* Functions required for roster-before-login flow. */
  onlineNetworksChanged: function() {
    for (var i = 0; i < model.onlineNetworks.length; ++i) {
      if (model.onlineNetworks[i].name === 'Quiver') {
        // User is logged into Quiver.
        if (!this.isQuiverLoggedIn) {
          // User just logged on, generate an invite URL.
          this.generateInviteUrl('Quiver').then((inviteUrl :string) => {
            this.quiverInviteUrl = inviteUrl;
          });
        }
        this.isQuiverLoggedIn = true;
        return;
      }
    }

    // User is not logged into Quiver
    this.quiverInviteUrl = '';
    this.isQuiverLoggedIn = false;
  },
  loginToQuiver: function() {
    model.globalSettings.quiverUserName = this.userName;
    core.updateGlobalSettings(model.globalSettings);
    this.login('Quiver', this.userName);
  },
  networkTapped: function(event: Event, detail: Object, target: HTMLElement) {
    var networkName = target.getAttribute('data-network');
    this.selectedNetworkName = networkName;
    // TODO: Consider moving this 'if logged in' logic inside
    // initInviteForNetwork. This would require ui.ts login to be fixed first
    // to remove possible race conditions:
    // https://github.com/uProxy/uproxy/issues/2064
    if (model.getNetwork(networkName)) {
      this.initInviteForNetwork(networkName);
    } else {
      // Open dialog asking user to login before inviting friends.
      this.$.loginToInviteFriendDialog.open();
    }
  },
  loginTapped: function() {
    this.login(this.selectedNetworkName).then(() => {
      this.initInviteForNetwork();
    });
  },
  initInviteForNetwork: function(networkName: string) {
    this.selectedNetworkName = networkName;
    if (networkName == "GMail" || networkName == "GitHub" || networkName == "Cloud") {
      // After login for these networks, open another view which allows users
      // to invite their friends.
      this.fire('core-signal', { name: 'open-network-invite-dialog' });
    } else if (networkName == "Facebook-Firebase-V2") {
      this.sendToFacebookFriend();
    }
  },
  loginToInviteFriendDialogOpened: function() {
    // Set confirmation message, which may include some HTML (e.g. strong, br).
    var confirmationMessage :string;
    if (this.selectedNetworkName === 'GitHub') {
      confirmationMessage = ui.i18n_t('GITHUB_LOGIN_CONFIRMATION');
    } else {
      confirmationMessage = ui.i18n_t(
          'SIGN_IN_TO_INVITE_FRIENDS',
          {network: ui.getNetworkDisplayName(this.selectedNetworkName)});
    }
    this.injectBoundHTML(
        ui.i18nSanitizeHtml(confirmationMessage),
        this.$.networkLoginConfirmation);

    // Without calling the resizeHandler, the dynamic contents
    // of the dialog confuse Polymer, and the size of the dialog
    // will be smaller than expected.
    this.$.loginToInviteFriendDialog.resizeHandler();
  },
  closeLoginDialog: function() {
    this.$.loginToInviteFriendDialog.close();
  },
  select: function(e :Event, d :Object, input :HTMLInputElement) {
    input.focus();
    input.select();
  },
  observe: {
    'model.networkNames': 'updateNetworkButtonNames',
    'model.onlineNetworks': 'onlineNetworksChanged',
  },
  ready: function() {
    this.userName = model.globalSettings.quiverUserName; // for Quiver
    this.supportsQuiver = false;
    this.isQuiverLoggedIn = false;
    this.githubUserIdInput = ''; // for GitHub
    this.inviteUserEmail = ''; // for GMail
    this.selectedNetworkName = '';
    this.quiverInviteUrl = '';
    this.cloudInstanceInput = '';
    this.ui = ui;
    this.model = model;

    this.updateNetworkButtonNames();
  }
};

(<any>_.mixin)(inviteUser, loginCommon);
Polymer(inviteUser);
