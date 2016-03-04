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
    return core.getInviteUrl({ network: info }).then((inviteUrl:string) => {
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
    core.inviteUser({
      networkId: selectedNetwork.name,
      userName: this.userIdInput
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
    if (this.network === 'Quiver') {
      this.generateInviteUrl('Quiver').then(() => {
        this.$.QuiverDialog.open();
      });
    } else if (this.network == "WeChat") {
      this.getWechatFriends();
    } else {
      this.$.networkInviteUserPanel.open();
    }
  },
  closeInviteUserPanel: function() {
    this.$.networkInviteUserPanel.close();
    this.$.QuiverDialog.close();
  },
  select: function(e :Event, d :Object, input :HTMLInputElement) {
    input.focus();
    input.select();
  },
  ready: function() {
    this.wechatInvites = {};
    this.wechatFriends = [];
    this.inviteUrl = '';
    this.inviteUserEmail = '';
    this.model = model;
    this.userIdInput = '';
  }
});
