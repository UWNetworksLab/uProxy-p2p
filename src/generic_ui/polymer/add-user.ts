/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

Polymer({
  openAddUserDialog: function() {
    this.$.addUserDialog.open();
    // TODO: pick network based on dropdown.
    // console.log('generating invite token');  // TODO: does this run each time we show the popup?  or just once?
    // ui_context.core.inviteUser('Email').then((token :string) => {
    //   this.inviteUrl = token;
    // });
  },
  addUser: function() {
    // TODO: pick network based on dropdown.
    ui_context.core.inviteUser('Email', this.userIdInput);
  },
  select: function(e :Event, d :Object, element :HTMLInputElement) {
    element.focus();
    element.select();
  },
  ready: function() {
    this.userIdInput = '';
    this.inviteUrl = '';
  }
});
