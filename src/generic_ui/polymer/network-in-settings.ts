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
    var networkApiStr = this.networkApi.name;
    if (this.networkApi.version) {
      networkApiStr = [networkApiStr, this.networkApi.version].join('-');
    }
    ui.login(networkApiStr)
        .catch((e :Error) => {
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
