/// <reference path='./context.d.ts' />

import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import net = require('../../../../third_party/uproxy-lib/net/net.types');
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
      this.ui.toastMessage = ui.i18n_t("FRIEND_OFFLINE", { name: this.userName });
      return;
    }

    ui.startGettingFromInstance(this.instance.instanceId).catch((e: Error) => {
      console.error('could not get access: ' + e.message);
    });
  },
  stop: function() {
    if (this.instance.localGettingFromRemote ==
        this.GettingState.TRYING_TO_GET_ACCESS) {
      ui.stopUsingProxy(true);
    } else {
      ui.stopUsingProxy();
    }
    ui.stopGettingFromInstance(this.instance.instanceId);
  }
});
