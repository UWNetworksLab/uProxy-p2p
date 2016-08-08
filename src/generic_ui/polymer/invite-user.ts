/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/browser.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import _ = require('lodash');
import model = require('../scripts/model');
import translator = require('../scripts/translator');
import user_interface = require('../scripts/ui');
import dialogs = require('../scripts/dialogs');

var ui = ui_context.ui;
var core = ui_context.core;

var inviteUser = {
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
    if (networkName === 'Cloud') {
      return this.cloudInstall();
    }
    this.selectedNetworkName = networkName;
    // TODO: Consider moving this 'if logged in' logic inside
    // initInviteForNetwork. This would require ui.ts login to be fixed first
    // to remove possible race conditions:
    // https://github.com/uProxy/uproxy/issues/2064
    if (ui_context.model.getNetwork(networkName)) {
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
  cloudInstall: function() {
    this.closeInviteUserPanel();
    this.fire('core-signal', { name: 'open-cloud-install' });
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
    // After login for these networks, open another view which allows users
    // to invite their friends.
    this.fire('core-signal', { name: 'open-network-invite-dialog' });
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
    if (networkName === 'Cloud') {
      return ui.i18n_t('NETWORK_LIST_CLOUD_LABEL');
    }
    return ui.getNetworkDisplayName(networkName);
  },
  closeLoginDialog: function() {
    this.$.loginToInviteFriendDialog.close();
  },
  acceptInvite: function() {
    ui.handleInvite(this.inviteCode).then(() => {
      this.closeInviteUserPanel();
      this.fire('core-signal', {
        name: 'show-toast',
        data: {
          toastMessage: translator.i18n_t('FRIEND_ADDED')
        }
      });
    }).catch(() => {
      this.$.state.openDialog(dialogs.getMessageDialogDescription(
        '', translator.i18n_t('FRIEND_ADD_ERROR')));
    });
  },
  ready: function() {
    this.selectedNetworkName = '';
    this.model = ui_context.model;
    this.inviteCode = '';
    // Disable creating a cloud server on Android for now (see #2633).
    this.hideCreateCloud = ui.isAndroid;
  }
};

Polymer(inviteUser);
