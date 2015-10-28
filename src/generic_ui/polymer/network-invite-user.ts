/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  generateInviteUrl: function(name: string) {
    var selectedNetwork = model.getNetwork(name);
    var info = {
      name: selectedNetwork.name,
      userId: selectedNetwork.userId
    };
    return core.getInviteUrl(info).then((inviteUrl:string) => {
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
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t("INVITE_EMAIL_SENT"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
    });
  },
  inviteGithubFriend: function() {
    var selectedNetwork =
      model.getNetwork('GitHub');
    core.inviteUser({
      networkId: selectedNetwork.name,
      userName: this.userIdInput
    }).then(() => {
      this.closeInviteUserPanel();
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t('INVITE_SENT_CONFIRMATION', { name: this.userIdInput }),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
    }).catch(() => {
      // TODO: The message in this dialog should be passed from the social provider.
      // https://github.com/uProxy/uproxy/issues/1923
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t("GITHUB_INVITE_SEND_FAILED"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
    });
  },
  openInviteUserPanel: function() {
    this.inviteUrl = '';
    this.$.panel.open();
  },
  closeInviteUserPanel: function() {
    this.$.panel.close();
  },
  showAcceptUserInvite: function() {
    this.closeInviteUserPanel();
    this.fire('core-signal', { name: 'open-accept-user-invite-dialog' });
  },
  ready: function() {
    this.inviteUrl = '';
    this.inviteUserEmail = '';
    this.model = model;
    this.userIdInput = '';
  }
});
