/// <reference path='./context.d.ts' />
/*
 * copypaste.ts
 *
 * This file handles the client interactions for the copypaste portion of the
 * app.
 */
import ui_constants = require('../../interfaces/ui');
import social = require('../../interfaces/social');

Polymer({
  init: function() {
    /* bring copyPaste to the front in get mode */
    ui_context.ui.view = ui_constants.View.COPYPASTE;

    if (ui_context.ui.copyPasteGettingState === social.GettingState.NONE) {
      this.startGetting();
    }
  },
  startGetting: function() {
    var doneStopping :Promise<void>;
    if (ui_context.ui.copyPasteGettingState !== social.GettingState.NONE) {
      console.warn('aborting previous copy+paste getting connection');
      doneStopping = this.stopGetting();
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.then(() => {
      ui_context.ui.copyPasteGettingMessage = '';
      ui_context.ui.copyPasteError = ui_constants.CopyPasteError.NONE;
      ui_context.ui.copyPastePendingEndpoint = null;

      return ui_context.core.startCopyPasteGet();
    }).then((endpoint) => {
      ui_context.ui.copyPastePendingEndpoint = endpoint;
    }).catch((e) => {
      // TODO we will see this any time the connection is aborted by the user or
      // when something actually goes wrong with the connection.  We should
      // come up with a good way to differentiate between the two and take
      // appropriate action in those cases.  In most cases, it seems this is not
      // an error, so we are just going to warn about it.

      console.warn('error when starting copy+paste get', e);
      ui_context.ui.copyPasteError = ui_constants.CopyPasteError.FAILED;
    });
  },
  handleBackClick: function() {
    // do not let the user navigate away from this view if copypaste is active
    if ((ui_context.ui.copyPasteGettingState === social.GettingState.GETTING_ACCESS && ui_context.ui.copyPastePendingEndpoint === null) ||
        ui_context.ui.copyPasteSharingState === social.SharingState.SHARING_ACCESS) {
      return;
    }

    if (ui_context.ui.copyPasteGettingState === social.GettingState.NONE &&
        ui_context.ui.copyPasteSharingState === social.SharingState.NONE) {
      ui_context.ui.view = ui_constants.View.SPLASH;
      return;
    }

    this.fire('open-dialog', {
      heading: 'Go back?',
      message: 'Are you sure you want to end this one-time connection?',
      buttons: [{
        text: 'Yes',
        signal: 'copypaste-back'
      }, {
        text: 'No',
        dismissive: true
      }]
    });
  },
  stopGetting: function() {
    return ui_context.core.stopCopyPasteGet().then(() => {
      // clean up the pending endpoint in case we got here from going back
      ui_context.ui.copyPastePendingEndpoint = null;
    });
  },
  startProxying: function() {
    if (!ui_context.ui.copyPastePendingEndpoint) {
      console.error('Attempting to start copy+paste proxying without a pending endpoint');
      return;
    }

    if (ui_context.ui.copyPasteGettingState !== social.GettingState.GETTING_ACCESS) {
      console.error('Attempting to start copy+paste when not getting access');
      return;
    }

    ui_context.ui.startGettingInUiAndConfig(null, ui_context.ui.copyPastePendingEndpoint);
    ui_context.ui.copyPastePendingEndpoint = null;
  },
  switchToGetting: function() {
    this.stopSharing().then(() => {
      if (ui_context.ui.copyPasteGettingState === social.GettingState.NONE) {
        this.startGetting();
      }
    });
  },
  stopSharing: function() {
    return ui_context.core.stopCopyPasteShare();
  },
  select: function(e :Event, d :Object, sender :HTMLInputElement) {
    sender.focus();
    sender.select();
  },
  dismissError: function() {
    ui_context.ui.copyPasteError = ui_constants.CopyPasteError.NONE;
  },
  exitMode: function() {
    // if we are currently in the middle of setting up a connection, end it
    var doneStopping :Promise<void>;
    if (ui_context.ui.copyPasteGettingState !== social.GettingState.NONE) {
      doneStopping = this.stopGetting()
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.catch((e) => {
      console.warn('Error while closing getting connection', e);
    }).then(() => {
      if (ui_context.ui.copyPasteSharingState !== social.SharingState.NONE) {
        return this.stopSharing();
      }
    }).catch((e) => {
      console.warn('Error while closing sharing connection', e);
    }).then(() => {
      // go back to the previous view regardless of whether we successfully
      // stopped the connection
      ui_context.ui.view = ui_constants.View.SPLASH;
    })
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.ui_constants = ui_constants;
    this.model = ui_context.model;
    this.GettingState = social.GettingState;
    this.SharingState = social.SharingState;
  }
});
