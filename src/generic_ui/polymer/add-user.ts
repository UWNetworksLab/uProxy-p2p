/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

declare var chrome: any;  // TODO:

Polymer({
  openAddUserDialog: function() {
    this.$.addUserDialog.open();
    // TODO: pick network based on dropdown.
    console.log('generating invite token');  // TODO: does this run each time we show the popup?  or just once?
    ui_context.core.generateInviteToken('Facebook').then((token :string) => {
      this.inviteUrl = token;
    });
  },
  addUser: function() {
    // TODO: pick network based on dropdown.
    ui_context.core.addUser('Facebook', this.userIdInput);
  },
  select: function(e :Event, d :Object, element :HTMLInputElement) {
    element.focus();
    element.select();
  },
  sendToFacebookFriend: function() {
      var facebookUrl = 'https://www.facebook.com/dialog/send?app_id=%20161927677344933&link=' +
          this.inviteUrl + '&redirect_uri=https://www.uproxy.org/';
      chrome.tabs.create({ url: facebookUrl });  // TODO: make work with Firefox
  },
  ready: function() {
    this.userIdInput = '';
    this.inviteUrl = '';
  }
});
