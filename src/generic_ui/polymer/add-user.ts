/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

declare var chrome: any;  // TODO:

Polymer({
  openAddUserDialog: function() {
    this.$.addUserDialog.open();
  },
  addUser: function() {
    // TODO: pick network based on dropdown.
    ui_context.core.addUser('Google+', this.userIdInput);
  },
  select: function(e :Event, d :Object, element :HTMLInputElement) {
    element.focus();
    element.select();
  },
  sendToGoogleFriend: function() {
      // var facebookUrl = 'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link=' +
      //     this.inviteUrl + '&redirect_uri=https://www.uproxy.org/';
      // chrome.tabs.create({ url: facebookUrl });  // TODO: make work with Firefox

      // TODO: pick network based on dropdown.
      console.log('generating invite token');  // TODO: does this run each time we show the popup?  or just once?
      ui_context.core.sendInviteToken('Google+', this.inviteUserId).then((token: string) => {
        this.inviteUrl = token;
      });
  },
  ready: function() {
    this.userIdInput = '';  // TODO: terrible name.  this is the token input
    this.inviteUrl = '';
    this.inviteUserId = '';
  }
});
