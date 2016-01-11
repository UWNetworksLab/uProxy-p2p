/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/typings/lodash/lodash.d.ts' />

import _ = require('lodash');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

//TODO: remove this when we switch to roster-as-default
var loginCommon = {
  copypaste: function() {
    // Logout of all other social networks before starting
    // copypaste connection.
    var getConfirmation = Promise.resolve<void>();
    if (model.onlineNetworks.length > 0) {
      var confirmationMessage =
          ui.i18n_t('CONFIRM_LOGOUT_FOR_COPYPASTE');
      getConfirmation = ui.getConfirmation('', confirmationMessage);
    }

    getConfirmation.then(ui.logoutAll).then(() => {
      if (this.closeInviteUserPanel) {
        this.closeInviteUserPanel();
      }
      this.fire('core-signal', { name: 'copypaste-init' });
    });
  },
  updateNetworkButtonNames: function() {
    this.networkButtonNames = _.filter(model.networkNames, (name) => {
      // we do not want a button for Quiver
      return name !== 'Quiver';
    });
    this.supportsQuiver = model.hasQuiverSupport();
  },
};
export = loginCommon;
