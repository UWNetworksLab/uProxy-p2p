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
      core.sendEmail({
          networkInfo: selectedNetworkInfo,
          to: this.inviteUserEmail,
          subject: ui.i18n_t('INVITE_EMAIL_SUBJECT'),
          body: ui.i18n_t('INVITE_EMAIL_BODY', { url: inviteUrl })
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
        message: 'Please complete invitation in Facebook',  // TODO:
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
      this.closeInviteUserPanel();
    });
  },
  onNetworkSelect: function(e :any, details :any) {
    if (details.isSelected) {
      this.selectedNetworkName = details.item.getAttribute('label');
    }
  },
  openInviteUserPanel: function() {
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
  ready: function() {
    this.inviteUserEmail = '';
    this.selectedNetworkName = '';
    this.model = model;
  }
});
