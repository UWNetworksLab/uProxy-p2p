/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import net = require('../../lib/net/net.types');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
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
    this.sas = null;
    this.VerifyState = social.VerifyState;
    // Feature code for verification
    this.ENABLE_VERIFY =
      model.globalSettings.enabledExperiments.indexOf(
        uproxy_core_api.FEATURE_VERIFY) >= 0;
  },
  start: function() {
    if (!this.instance.isOnline) {
      this.ui.toastMessage = ui.i18n_t('FRIEND_OFFLINE', { name: this.user.name });
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
  sasUpdated: function() {
    this.sas = this.instance.verifySAS;
  },
  verify: function() {
    if (this.instance.verifyState !== social.VerifyState.VERIFY_BEGIN) {
      ui.startVerifying(this.instance);
    } else {
      console.log('instance is already in verification.');
    }
  },
  confirmSAS: function() {
    console.log('Verified SAS');
    this.sas = null;
    ui.finishVerifying(this.instance, true);
  },
  rejectSAS: function() {
    console.log('Rejected SAS');
    this.sas = null;
    ui.finishVerifying(this.instance, false);
  },
  observe: {
    'instance.isOnline': 'fireChanged',
    'instance.verifySAS': 'sasUpdated',
  },
});
