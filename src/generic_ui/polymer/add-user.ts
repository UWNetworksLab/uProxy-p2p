/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

Polymer({
  openAddUserDialog: function() {
    this.$.addUserDialog.open();
  },
  addUser: function() {
    // TODO: pick network based on dropdown.
    ui_context.core.addUser('Email', this.userIdInput);
  },
  generateInvite: function() {
    // TODO: pick network based on dropdown.
    ui_context.core.generateInviteToken('Email').then((token :string) => {
      this.inviteUrl = token;
    });
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
