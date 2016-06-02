/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import net = require('../../lib/net/net.types');
import user_interface = require('../scripts/ui');

// generic_ui/scripts/ui.ts: UserInterface
var ui = ui_context.ui;
// generic_ui/scripts/core_connector.ts: CoreConnector
var core = ui_context.core;
// generic_ui/scripts/ui.ts: Model
var model = ui_context.model;

Polymer({
  // Two component constructor arguments:
  //  user :User (generic_ui/scripts/user.ts)
  //  instance :InstanceData (interfaces/social.ts)
  ready: function() {
    // Expose global ui object and UI module in this context. This allows the
    // hidden? watch for the get/give toggle to actually update.
    this.ui = ui;
    this.ui_constants = ui_constants;
    this.GettingState = social.GettingState;
    this.model = model;
    this.VerifyState = social.VerifyState;
  },
  start: function() {
    if (!this.instance.isOnline) {
      this.ui.toastMessage = ui.i18n_t("FRIEND_OFFLINE", { name: this.user.name });
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
  },
  fireChanged: function() {
    this.fire('instance-changed');
  },
  verify: function() {
    if (this.instance.verifyState != social.VerifyState.VERIFY_BEGIN) {
      console.log("Starting verify.");
      ui.startVerifying(this.user.network, this.instance);
    } else {
      console.log("instance is already verified.");
    }
  },
  confirmSAS: function() {
    console.log("Verified SAS");
  },
  rejectSAS: function() {
    console.log("Rejected SAS");
  },
  observe: {
    'instance.isOnline': 'fireChanged',
  },
});
