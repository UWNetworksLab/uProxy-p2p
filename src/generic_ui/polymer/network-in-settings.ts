/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  signedIn: false,
  networkInfo: null,
  updateSignedIn: function() {
    var network = model.getNetwork(this.name);
    this.signedIn = !!network;
    this.networkInfo = network ? network : null;
  },
  connect: function() {
    ui.login(this.name).catch((e :Error) => {
      console.warn('Did not log in', e);
    });
  },
  logout: function() {
    if (!this.signedIn) {
      return;
    }

    ui.logout({
      name: this.name,
      userId: this.networkInfo.userId
    })
  },
  ready: function() {
    this.model = model;
  },
  observe: {
    'model.onlineNetworks': 'updateSignedIn'
  }
});
