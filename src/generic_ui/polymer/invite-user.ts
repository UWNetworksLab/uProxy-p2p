/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  sendToGMailFriend: function() {
    var selectedNetwork =
        model.onlineNetworks[this.$.networkSelectMenu.selectedIndex];
    var selectedNetworkInfo = {
      name: selectedNetwork.name,
      userId: selectedNetwork.userId
    };
    core.getInviteUrl(selectedNetworkInfo).then((inviteUrl: string) => {
      var name = selectedNetwork.userName || selectedNetwork.userId;
      var emailBody =
      core.sendEmail({
          networkInfo: selectedNetworkInfo,
          to: this.inviteUserEmail,
          subject: ui.i18n_t('INVITE_EMAIL_SUBJECT', { name: name }),
          body: ui.i18n_t('INVITE_EMAIL_BODY', { url: inviteUrl, name: name })
      });
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t("INVITE_EMAIL_SENT"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
      this.closeInviteUserPanel();
    });

  },
  sendToFacebookFriend: function() {
    var selectedNetwork =
      model.onlineNetworks[this.$.networkSelectMenu.selectedIndex];
    var selectedNetworkInfo = {
      name: selectedNetwork.name,
      userId: selectedNetwork.userId
    };
    core.getInviteUrl(selectedNetworkInfo).then((inviteUrl: string) => {
      var facebookUrl =
          'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link='
          + inviteUrl + '&redirect_uri=https://www.uproxy.org/';
      ui.openTab(facebookUrl);
      this.fire('open-dialog', {
        heading: '', // TODO:
        message: ui.i18n_t("FACEBOOK_INVITE_IN_BROWSER"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
      this.closeInviteUserPanel();
    });
  },
  inviteGithubFriend: function() {
    var selectedNetwork =
      model.onlineNetworks[this.$.networkSelectMenu.selectedIndex];
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
  addCloudInstance: function() {
    var selectedNetwork =
      model.onlineNetworks[this.$.networkSelectMenu.selectedIndex];
    core.inviteUser({
      networkId: selectedNetwork.name,
      userName: this.cloudInstanceInput
    }).then(() => {
      console.log('invited!');
      this.closeInviteUserPanel();
    }).catch(() => {
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t("CLOUD_INVITE_FAILED"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
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
    this.$.inviteUserPanel.open();
  },
  closeInviteUserPanel: function() {
    this.$.inviteUserPanel.close();
  },
  showAcceptUserInvite: function() {
    this.fire('core-signal', { name: 'open-accept-user-invite-dialog' });
  },
  setOnlineInviteNetworks: function() {
    this.onlineInviteNetworks = [];
    for (var i = 0; i < model.onlineNetworks.length; ++i) {
      var name = model.onlineNetworks[i].name;
      if (ui.supportsInvites(name)) {
        this.onlineInviteNetworks.push({
          name: name,
          displayName: ui.getNetworkDisplayName(name)
        });
      }
    }
  },
  ready: function() {
    this.inviteUserEmail = '';
    this.selectedNetworkName = '';
    this.model = model;
    this.userIdInput = '';
    this.cloudInstanceInput = '';
  }
});
