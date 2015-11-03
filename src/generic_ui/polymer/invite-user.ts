/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;
var core = ui_context.core;

Polymer({
  generateInviteUrl: function(name :string) {
    var selectedNetwork = model.getNetwork(name);
    var info = {
      name: selectedNetwork.name,
      userId: selectedNetwork.userId
    };
    return core.getInviteUrl(info).then((inviteUrl :string) => {
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
  generateQuiverInviteUrl: function() {
    return this.generateInviteUrl('Quiver');
  },
  sendToFacebookFriend: function() {
    this.generateInviteUrl('Facebook-Firebase-V2').then(() => {
      var facebookUrl =
          'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link='
          + this.inviteUrl + '&redirect_uri=https://www.uproxy.org/';
      ui.openTab(facebookUrl);
      this.closeInviteUserPanel();
      this.fire('open-dialog', {
        heading: '', // TODO:
        message: ui.i18n_t("FACEBOOK_INVITE_IN_BROWSER"),
        buttons: [{
          text: ui.i18n_t("OK")
        }]
      });
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
      this.closeInviteUserPanel();
      this.fire('open-dialog', {
        heading: '',
        message: ui.i18n_t("GITHUB_INVITE_SEND_FAILED"),
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

  /* Functions required for roster-before-login flow. */
  updateQuiverStatus: function() {
    this.isQuiverLoggedIn = false;
    for (var i = 0; i < model.onlineNetworks.length; ++i) {
      var name = model.onlineNetworks[i].name;
      if (name == "Quiver") {
        this.isQuiverLoggedIn = true;
        break;
      }
    }
  },
  loginToQuiver: function() {
    model.globalSettings.quiverUserName = this.userName;
    core.updateGlobalSettings(model.globalSettings);
    this.login('Quiver', this.userName);
  },
  networkTapped: function(event: Event, detail: Object, target: HTMLElement) {
    var networkName = target.getAttribute('data-network');
    this.selectedNetworkName = networkName;
    if (model.getNetwork(networkName)) {
      this.initInviteForNetwork(networkName);
    } else {
      // Open dialog asking user to login before inviting friends.
      this.$.loginToInviteFriendDialog.open();
    }
  },
  loginTapped: function(event: Event, detail: Object, target: HTMLElement) {
    var networkName = target.getAttribute('data-network');
    this.login(networkName);
  },
  login: function(networkName :string, userName ?:string) {
    ui.login(networkName, userName).then(() => {
      if (networkName != 'Quiver') {
        this.$.loginToInviteFriendDialog.close();
        this.closeInviteUserPanel();
      }
      ui.bringUproxyToFront();
      this.initInviteForNetwork(networkName);
    }).catch((e: Error) => {
      console.warn('Did not log in ', e);
    });
  },
  initInviteForNetwork: function(networkName: string) {
    this.selectedNetworkName = networkName;
    if (networkName == "GMail" || networkName == "GitHub") {
      // After login for these networks, open another view which allows users
      // to invite their friends.
      this.fire('core-signal', { name: 'open-network-invite-dialog' });
    } else if (networkName == "Facebook-Firebase-V2") {
      this.sendToFacebookFriend();
    }
  },
  copypaste: function() {
    // Logout of all other social networks before starting
    // copypaste connection.
    var logoutPromises :Promise<void>[] = [];
    for (var i in model.onlineNetworks) {
      logoutPromises.push(ui.logout({
        name: model.onlineNetworks[i].name,
        userId: model.onlineNetworks[i].userId
      }).catch((e :Error) => {
        console.error('logout returned error: ', e);
      }));
    }
    Promise.all(logoutPromises).then(() => {
      this.closeInviteUserPanel();
      this.fire('core-signal', { name: 'copypaste-init' });
    });
  },
  loginToInviteFriendDialogOpened: function() {
    // Without calling the resizeHandler, the dynamic contents
    // of the dialog confuse Polymer, and the size of the dialog
    // will be smaller than expected.
    this.$.loginToInviteFriendDialog.resizeHandler();
  },
  updateNetworkButtonNames: function() {
    var supportsQuiver = false;
    this.networkButtonNames = [];
    for (var i = 0; i < model.networkNames.length; ++i) {
      if (model.networkNames[i] === 'Quiver') {
        supportsQuiver = true;
      } else {
        this.networkButtonNames.push(model.networkNames[i]);
      }
    }
    // Only set .supportsQuiver after iterating through all networks, to prevent
    // any flicker in case we switch from true to false to true again.
    this.supportsQuiver = supportsQuiver;
  },
  getNetworkDisplayName: function(name :string) {
    return ui.getNetworkDisplayName(name);
  },
  isExperimentalNetwork: function(name :string) {
    return ui.isExperimentalNetwork(name);
  },
  supportsInvites: function(name :string) {
    return ui.supportsInvites(name);
  },
  observe: {
    'model.networkNames': 'updateNetworkButtonNames',
    'model.onlineNetworks': 'updateQuiverStatus'
  },
  ready: function() {
    this.userName = model.globalSettings.quiverUserName; // for Quiver
    this.supportsQuiver = false;
    this.isQuiverLoggedIn = false;
    this.userIdInput = ''; // for GitHub
    this.inviteUserEmail = ''; // for GMail
    this.inviteUrl = '';
    this.selectedNetworkName = '';
    this.model = model;
    this.ui = ui;

    this.updateNetworkButtonNames();
  }
});
