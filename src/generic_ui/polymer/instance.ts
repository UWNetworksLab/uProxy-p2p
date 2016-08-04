/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import net = require('../../lib/net/net.types');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import translator = require('../scripts/translator');
import user_interface = require('../scripts/ui');
import browser_api = require('../../interfaces/browser_api');

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
    this.sas = null;
    // Whether this is the side that started verification.  The sides
    // of the verification show different UIs.
    this.startedVerify = false;
    this.VerifyState = social.VerifyState;
    // Feature code for verification
    this.ENABLE_VERIFY =
      model.globalSettings.enabledExperiments.indexOf(
        uproxy_core_api.FEATURE_VERIFY) >= 0;
  },
  start_: function(accessMode: browser_api.ProxyAccessMode) {
    if (!this.instance.isOnline) {
      this.fire('core-signal', {
        name: 'show-toast',
        data: {
          toastMessage: translator.i18n_t('FRIEND_OFFLINE',
                                          { name: this.user.name })
        }
      });
      return;
    }

    this.sas = null;
    ui.startGettingFromInstance(this.instance.instanceId, accessMode)
      .catch((e: Error) => {
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
  startBrowsing: function() {
    this.start_(browser_api.ProxyAccessMode.IN_APP);
  },
  startVpn: function() {
    this.start_(browser_api.ProxyAccessMode.VPN);
  },
  fireChanged: function() {
    this.fire('instance-changed');
  },
  sasUpdated: function() {
    // We don't use instance.verifySAS directly.  Instead, we use
    // this.sas to mean:
    //  - When null, there is no SAS to verify.  Hide the
    //    Confirm/Reject buttons.
    //  - When non-null, show the number and ask for confirmation.
    //
    // So we watch instance.verifySAS for null -> number transitions
    // here, and show our buttons as needed.  We can immedatiately set
    // this.sas back to null when the user hits confirm/reject, and
    // hide the buttons then.

    // First check for cancellation
    if (this.instance.verifySAS === null &&
        this.sas !== null) {
      console.log('App or remote cancellation.');
      this.rejectSAS();
    } else if (this.instance.verifySAS !== undefined) {
      // Nope, the app-level KeyVerify session has a SAS to show.
      this.sas = this.instance.verifySAS;
    }
  },
  verify: function() {
    if (this.instance.verifyState !== social.VerifyState.VERIFY_BEGIN) {
      ui.startVerifying(this.instance);
      this.startedVerify = true;
    } else {
      console.log('instance is already in verification.');
    }
  },
  confirmSAS: function() {
    console.log('Verified SAS');
    this.sas = null;
    ui.finishVerifying(this.instance, true);
    this.startedVerify = false;
  },
  rejectSAS: function() {
    console.log('Rejected SAS');
    this.sas = null;
    ui.finishVerifying(this.instance, false);
    this.startedVerify = false;
  },
  observe: {
    'instance.isOnline': 'fireChanged',
    'instance.verifySAS': 'sasUpdated',
  },
});
