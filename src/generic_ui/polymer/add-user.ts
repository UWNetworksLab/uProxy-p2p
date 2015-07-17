/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

Polymer({
  openAddUserDialog: function() {
    this.$.addUserDialog.open();
  },
  addUser: function() {
    this.core.addUser(this.userIdInput);
  },
  ready: function() {
    this.core = ui_context.core;
    this.userIdInput = '';
  }
});
