/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  sendToGMailFriend: function() {
    // TODO: how to get userId of logged in  user?
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
          subject: 'Join me on uProxy',
          body: 'Click here to join me on uProxy' + inviteUrl
      });
      this.fire('open-dialog', {
        heading: 'Invitation Email sent', // TODO: translate
        message: '',  // TODO:
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
    // TODO: does this need to be initialized?
    console.log('onNetworkSelect: ', details);
    if (details.isSelected) {
      this.selectedNetworkName = details.item.getAttribute('label');
    }
  },
  openInviteUserPanel: function() {
    // Reset selectedNetworkName in case it had been set and that network
    // is no longer online.
    // this.selectedNetworkName = model.onlineNetworks[0].name;
    this.$.networkSelectMenu.selectIndex(0);
    this.$.inviteUserPanel.open();
  },
  closeInviteUserPanel: function() {
    this.$.inviteUserPanel.close();
  },
  showAcceptUserInvite: function() {
    this.fire('core-signal', { name: 'open-accept-user-invite-dialog' });
  },
  getNetworkDisplayName: function(selectedNetworkName :string){
    return ui.getNetworkDisplayName(selectedNetworkName);
  },
  ready: function() {
    this.inviteUserEmail = '';
    this.selectedNetworkName = '';
    this.model = model;
  }
});
