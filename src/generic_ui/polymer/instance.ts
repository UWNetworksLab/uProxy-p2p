/// <reference path='./context.d.ts' />

import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import net = require('../../../../third_party/uproxy-networking/net/net.types');
import user_interface = require('../scripts/ui');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  ready: function() {
    // Expose global ui object and UI module in this context. This allows the
    // hidden? watch for the get/give toggle to actually update.
    this.ui = ui;
    this.ui_constants = ui_constants;
    this.GettingState = social.GettingState;
    this.model = model;
  },
  start: function() {
    if (!this.instance.isOnline) {
      this.ui.toastMessage = this.user.name + ' is offline';
      return;
    }

    ui.startGettingFromInstance(this.instance.instanceId);
  },
  stop: function() {
    ui.stopGettingFromInstance(this.instance.instanceId);
  }
});
