/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  generateInviteUrl: function() {
    var selectedNetwork =
        model.onlineNetworks[this.$.networkSelectMenu.selectedIndex];
    var info = {
      name: selectedNetwork.name,
      userId: selectedNetwork.userId
    };
    return core.getInviteUrl(info).then((inviteUrl:string) => {
      this.inviteUrl = inviteUrl;
      return selectedNetwork;
    });
  },
  sendWechatInvites: function() {
    var selectedNetwork = model.getNetwork("WeChat");
    for (var user in this.wechatInvites) {
      if (this.wechatInvites[user]) {
        core.inviteUser({
          networkId: selectedNetwork.name,
          userName: user
        }).then(() => {
          console.log("Invite sent to: " + user);
        }).catch(() => {
          console.log("Failed to invite: " + user);
        });
      }
    }
    this.fire('open-dialog', {
      heading: ui.i18n_t("WECHAT_INVITES_SENT"),
      message: ui.i18n_t("WECHAT_INVITES_ACCEPTED_WHEN"),
      buttons: [{
        text: ui.i18n_t("OK")
      }]
    });
    this.closeInviteUserPanel();
  },
  getWechatFriends: function() {
    var selectedNetwork = model.getNetwork("WeChat");
    var info = {
      name: selectedNetwork.name,
      userId: selectedNetwork.userId
    };
    return core.getAllUserProfiles(info).then((roster: any) => {
      for(var i = 0; i < roster.length; i++) {
        var friend = roster[i];
        this.wechatFriends[i] = friend;
        this.wechatInvites[friend.userId] = false;
      }
      return selectedNetwork;
    });
  },
  sendToGMailFriend: function() {
    this.generateInviteUrl().then((selectedNetwork:any) => {
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
    this.generateInviteUrl().then(() => {
      var facebookUrl =
          'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link='
          + this.inviteUrl + '&redirect_uri=https://www.uproxy.org/';
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
    if (this.selectedNetworkName == "WeChat") {
      this.getWechatFriends();
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
    this.inviteUrl = '';
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
    this.wechatInvites = {};
    this.wechatFriends = [];
    this.inviteUrl = '';
    this.inviteUserEmail = '';
    this.selectedNetworkName = '';
    this.model = model;
    this.userIdInput = '';
    this.cloudInstanceInput = '';
  }
});
