/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import user_interface = require('../scripts/ui');
import _ = require('lodash');
var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

var inviteUser = {
  generateInviteUrl: function(name :string) {
    var network = model.getNetwork(name);
    var networkInfo = { name: network.name, userId: network.userId };
    return core.getInviteUrl({ network: networkInfo });
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
  openInviteUserPanel: function() {
    // Reset the input, expectation is for it to be empty
    this.inviteCode = '';
    // Forces the placeholder text to be visible again.
    this.$.inviteCodeDecorator.updateLabelVisibility(this.inviteCode);

    this.injectBoundHTML(
        ui.i18nSanitizeHtml(ui.i18n_t('WE_WONT_POST_LEARN_MORE')),
        this.$.weWontPostLearnMore);

    this.$.inviteUserPanel.open();
  },
  closeInviteUserPanel: function() {
    this.$.inviteUserPanel.close();
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
      if (networkName === 'Quiver') {
        return ui.loginToQuiver().then(() => {
          this.initInviteForNetwork('Quiver');
        });
      } else {
        // Open dialog asking user to login before inviting friends.
        this.$.loginToInviteFriendDialog.open();
      }
    }
  },
  loginTapped: function() {
    // loginTapped should only be called by the loginToInviteFriendDialog, which
    // is not used for Quiver.
    if (this.selectedNetworkName === 'Quiver') {
      throw Error('invite-user.ts: loginTapped called for Quiver');
    }

    ui.login(this.selectedNetworkName).then(() => {
      this.$.loginToInviteFriendDialog.close();
      this.closeInviteUserPanel();
      ui.bringUproxyToFront();
      this.initInviteForNetwork(this.selectedNetworkName);
    });
  },
  initInviteForNetwork: function(networkName: string) {
    this.selectedNetworkName = networkName;
    if (['GMail', 'GitHub', 'Cloud', 'Quiver'].indexOf(networkName) >= 0) {
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
  getNetworkDisplayName: function(networkName :string) {
    return ui.getNetworkDisplayName(networkName);
  },
  isExperimentalNetwork: function(networkName :string) {
    return ui.isExperimentalNetwork(networkName);
  },
  closeLoginDialog: function() {
    this.$.loginToInviteFriendDialog.close();
  },
  acceptInvite: function() {
    ui.handleInvite(this.inviteCode).then(() => {
      this.closeInviteUserPanel();
      ui.showDialog('', ui.i18n_t('FRIEND_ADDED'));
    }).catch(() => {
      ui.showDialog('', ui.i18n_t('FRIEND_ADD_ERROR'));
    });
  },
  copypaste: function() {
    // Logout of all other social networks before starting
    // copypaste connection.
    var getConfirmation = Promise.resolve<void>();
    if (model.onlineNetworks.length > 0) {
      var confirmationMessage = (ui.isGettingAccess() || ui.isGivingAccess()) ?
          ui.i18n_t('CONFIRM_LOGOUT_FOR_COPYPASTE_WHILE_PROXYING') :
          ui.i18n_t('CONFIRM_LOGOUT_FOR_COPYPASTE');
      getConfirmation = ui.getConfirmation('', confirmationMessage);
    }

    getConfirmation.then(() => {
      return ui.logoutAll(false);  // Don't show confirmation again.
    }).then(() => {
      if (this.closeInviteUserPanel) {
        this.closeInviteUserPanel();
      }
      this.fire('core-signal', { name: 'copypaste-init' });
    });
  },
  ready: function() {
    this.inviteUrl = '';
    this.inviteUserEmail = ''; // for GMail
    this.selectedNetworkName = '';
    this.ui = ui;
    this.model = model;
    this.inviteCode = '';
  }
};

Polymer(inviteUser);
