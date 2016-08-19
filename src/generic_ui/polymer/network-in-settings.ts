/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/typings/index.d.ts' />

import translator = require('../scripts/translator');
import dialogs = require('../scripts/dialogs');

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
    if (this.name == 'Quiver') {
      ui.loginToQuiver();
    } else {
      ui.login(this.name).catch((e :Error) => {
        console.warn('Did not log in', e);
      });
    }
    this.fire('core-signal', {name: 'close-settings'});
  },
  logout: function() {
    if (!this.signedIn) {
      return;
    }

    // Check if we are getting or sharing on this network.
    // TODO(jpevarnek) stop looking at "private" ui state here
    var isGettingForThisNetwork = false;
    if (ui.instanceGettingAccessFrom_) {
      var user = ui.mapInstanceIdToUser_[ui.instanceGettingAccessFrom_];
      if (user && user.network.name === this.name) {
        isGettingForThisNetwork = true;
      }
    }

    var isSharingForThisNetwork = false;
    var sharingTo = Object.keys(ui.instancesGivingAccessTo);
    for (var i = 0; i < sharingTo.length; ++i) {
      user = ui.mapInstanceIdToUser_[sharingTo[i]];
      if (user && user.network.name === this.name) {
        isSharingForThisNetwork = true;
        break;
      }
    }

    var confirmLogout = Promise.resolve<void>();
    if (isGettingForThisNetwork || isSharingForThisNetwork) {
      var confirmationMessage = dialogs.getLogoutConfirmationMessage(isGettingForThisNetwork, isSharingForThisNetwork);
      confirmLogout = this.$.state.openDialog(dialogs.getConfirmationDialogDescription('', confirmationMessage));
    }

    confirmLogout.then(() => {
      this.$.state.background.logout({
        name: this.name,
        userId: this.networkInfo.userId
      });
    });
  },
  ready: function() {
    this.model = model;
    this.displayName = ui.getNetworkDisplayName(this.name);
  },
  observe: {
    'model.onlineNetworks': 'updateSignedIn'
  }
});
