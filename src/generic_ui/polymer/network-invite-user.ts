/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />

import social = require('../../interfaces/social');
import translator = require('../scripts/translator');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import dialogs = require('../scripts/dialogs');

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  generateInviteUrl: function(networkName: string) {
    var selectedNetwork = model.getNetwork(networkName);
    var createInviteArgs :uproxy_core_api.CreateInviteArgs = {
      network: {
        name: selectedNetwork.name,
        userId: selectedNetwork.userId
      },
      isRequesting: this.requestAccess,
      isOffering: this.offerAccess
    };
    return core.getInviteUrl(createInviteArgs).then((inviteUrl:string) => {
      this.inviteUrl = inviteUrl;
      return selectedNetwork;
    });
  },
  sendToFacebookFriend: function() {
    this.generateInviteUrl('Facebook-Firebase-V2').then(() => {
      var encodedInviteUrl = encodeURIComponent(this.inviteUrl);

      // Open a "Send Message" dialog to send a Facebook Message.
      // See https://developers.facebook.com/docs/sharing/reference/send-dialog
      // This is our preferred dialog, but it is not available on mobile web.
      var facebookSendUrl =
          'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link='
          + encodedInviteUrl + '&redirect_uri=https://www.uproxy.org/autoclose';
      // Open a "Share" dialog to produce a timeline post.
      // See https://developers.facebook.com/docs/sharing/reference/share-dialog
      // This is available on mobile, but only offers timeline posts, which may
      // not notify their recipients.
      var facebookShareUrl =
          'https://m.facebook.com/dialog/share?app_id=%20161927677344933&href='
          + encodedInviteUrl + '&redirect_uri=https://www.uproxy.org/autoclose';
      var facebookUrl = navigator.userAgent.indexOf('Mobile Safari') === -1 ?
          facebookSendUrl : facebookShareUrl;
      ui.openTab(facebookUrl);
      this.closeInviteUserPanel();
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
      this.$.state.openDialog(dialogs.getMessageDialogDescription('', translator.i18n_t('INVITE_EMAIL_SENT')));
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
      userId: this.gitHubUserIdInput
    }).then(() => {
      this.closeInviteUserPanel();
      this.$.state.openDialog(dialogs.getMessageDialogDescription('',
            translator.i18n_t('INVITE_SENT_CONFIRMATION', { name: this.gitHubUserIdInput })));
    }).catch(() => {
      // TODO: The message in this dialog should be passed from the social provider.
      // https://github.com/uProxy/uproxy/issues/1923
      this.$.state.openDialog(dialogs.getMessageDialogDescription('',
            translator.i18n_t('GITHUB_INVITE_SEND_FAILED')));
    });
  },
  openInviteUserPanel: function() {
    this.initFields();
    this.$.networkInviteUserPanel.open();
  },
  closeInviteUserPanel: function() {
    this.$.networkInviteUserPanel.close();
  },
  select: function(e :Event, d :Object, input :HTMLInputElement) {
    input.focus();
    input.select();
  },
  confirmClicked: function() {
    if (this.network === 'GitHub') {
      this.inviteGithubFriend();
    } else if (this.network === 'GMail') {
      this.sendToGMailFriend();
    } else if (this.network === 'Facebook-Firebase-V2') {
      this.sendToFacebookFriend();
    } else if (this.network === 'Quiver') {
      // Generate Quiver invite url.  Will set this.inviteUrl.
      this.generateInviteUrl('Quiver');
      // Disable controls so user can't generate a different link with
      // modified permissions.
      this.$.requestAccessCheckbox.disabled = true;
      this.$.offerAccessCheckbox.disabled = true;
      this.$.confirmButton.disabled = true;
    }
  },
  initFields: function() {
    // Fields which should be reset every time this screen opens.
    this.inviteUrl = '';
    this.inviteUserEmail = '';
    this.model = model;
    this.gitHubUserIdInput = '';
    this.offerAccess = false;
    this.requestAccess = false;
    this.instructions = getInstructions(this.network)
    this.confirmText = getConfirmText(this.network);
    // Forces the placeholder text to be visible again.
    this.$.GitHubPlaceholder.updateLabelVisibility('');
    this.$.GMailPlaceholder.updateLabelVisibility('');
    // Enable checkboxes and buttons.
    this.$.requestAccessCheckbox.disabled = false;
    this.$.offerAccessCheckbox.disabled = false;
    this.$.confirmButton.disabled = false;
  },
  ready: function() {
    this.initFields();
  }
});

function getInstructions(networkName :string) {
  var label :string = (<any>{
    'GitHub': 'GITHUB_INVITE_INSTRUCTIONS',
    'GMail': 'GMAIL_INVITE_INSTRUCTIONS',
    'Facebook-Firebase-V2': 'FACEBOOK_INVITE_INSTRUCTIONS',
    'Quiver': 'QUIVER_INVITE_INSTRUCTIONS'
  })[networkName];
  return label ? ui.i18n_t(label) : '';
}

function getConfirmText(networkName :string) {
  var label :string = (<any>{
    'GitHub': 'SEND_INVITATION',
    'GMail': 'SEND_INVITATION',
    'Facebook-Firebase-V2': 'SEND_INVITATION_FACEBOOK',
    'Quiver': 'GENERATE_LINK'
  })[networkName];
  return label ? ui.i18n_t(label) : '';
}
