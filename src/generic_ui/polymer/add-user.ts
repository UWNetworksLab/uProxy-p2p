/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

Polymer({
  addUser: function() {
    // TODO: Fix this.
    // TODO: addUser is now a Promise command -- what now?
    this.core.addUser(JSON.stringify({ networkId: this.userIdInput, userId: this.userIdInput }));
    //this.core.addUser(this.userIdInput);
  },
  ready: function() {
    this.core = ui_context.core;
    this.userIdInput = '';
  }
});
