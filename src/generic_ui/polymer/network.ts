/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='./context.d.ts' />

import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  connect: function() {
    var networkApiStr = this.networkApi.name;
    if (this.networkApi.version) {
      networkApiStr = [networkApiStr, this.networkApi.version].join('-');
    }
    ui.login(networkApiStr).then(() => {
      console.log('connected to ' + this.networkApi);
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', { view: ui_constants.View.ROSTER });
      ui.bringUproxyToFront();
    }).catch((e :Error) => {
      console.warn('Did not log in ', e);
    });
  },
  ready: function() {
  },
});
