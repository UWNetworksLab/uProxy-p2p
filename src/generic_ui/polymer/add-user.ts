/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var model = ui_context.model;

Polymer({
  openAddUserDialog: function() {
    // Clear networkNames (can't re-assign due to Polymer bindings)
    for (var i = 0; i < this.networkNames.length; ++i) {
      this.networkNames.pop();
    }
    for (i = 0; i < model.onlineNetworks.length; ++i) {
      this.networkNames.push(model.onlineNetworks[i].name);
    }
    this.$.addUserDialog.open();
  },
  addUser: function() {
    // TODO: pick network based on dropdown.
    ui_context.core.addUser('Google+', this.receivedInviteToken);
  },
  sendToGoogleFriend: function() {
    ui_context.core.sendInviteToken('Google+', this.inviteUserEmail);
  },
  sendToFacebookFriend: function() {
    // TODO: get invite token
    var facebookUrl = 'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link=' +
        this.inviteUrl + '&redirect_uri=https://www.uproxy.org/';
    ui.openTab(facebookUrl);
  },
  onNetworkSelect: function(e :any, details :any) {
    // TODO: does this need to be initialized?
    this.selectedNetwork = details.item.getAttribute('label');
  },
  ready: function() {
    this.receivedInviteToken = '';
    this.inviteUserEmail = '';
    this.selectedNetwork = '';
    this.networkNames = [];
  }
});
