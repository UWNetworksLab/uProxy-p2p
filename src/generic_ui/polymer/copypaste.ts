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
    browserified_exports.ui.view = ui_constants.View.COPYPASTE;

    if (browserified_exports.ui.copyPasteGettingState === social.GettingState.NONE) {
      this.startGetting();
    }
  },
  startGetting: function() {
    var doneStopping :Promise<void>;
    if (browserified_exports.ui.copyPasteGettingState !== social.GettingState.NONE) {
      console.warn('aborting previous copy+paste getting connection');
      doneStopping = this.stopGetting();
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.then(() => {
      browserified_exports.ui.copyPasteGettingMessage = '';
      browserified_exports.ui.copyPasteError = ui_constants.CopyPasteError.NONE;
      browserified_exports.ui.copyPastePendingEndpoint = null;

      return browserified_exports.core.startCopyPasteGet();
    }).then((endpoint) => {
      browserified_exports.ui.copyPastePendingEndpoint = endpoint;
    }).catch((e) => {
      // TODO we will see this any time the connection is aborted by the user or
      // when something actually goes wrong with the connection.  We should
      // come up with a good way to differentiate between the two and take
      // appropriate action in those cases.  In most cases, it seems this is not
      // an error, so we are just going to warn about it.

      console.warn('error when starting copy+paste get', e);
      browserified_exports.ui.copyPasteError = ui_constants.CopyPasteError.FAILED;
    });
  },
  handleBackClick: function() {
    // do not let the user navigate away from this view if copypaste is active
    if ((browserified_exports.ui.copyPasteGettingState === social.GettingState.GETTING_ACCESS && browserified_exports.ui.copyPastePendingEndpoint === null) ||
        browserified_exports.ui.copyPasteSharingState === social.SharingState.SHARING_ACCESS) {
      return;
    }

    if (browserified_exports.ui.copyPasteGettingState === social.GettingState.NONE &&
        browserified_exports.ui.copyPasteSharingState === social.SharingState.NONE) {
      browserified_exports.ui.view = ui_constants.View.SPLASH;
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
    return browserified_exports.core.stopCopyPasteGet().then(() => {
      // clean up the pending endpoint in case we got here from going back
      browserified_exports.ui.copyPastePendingEndpoint = null;
    });
  },
  startProxying: function() {
    if (!browserified_exports.ui.copyPastePendingEndpoint) {
      console.error('Attempting to start copy+paste proxying without a pending endpoint');
      return;
    }

    if (browserified_exports.ui.copyPasteGettingState !== social.GettingState.GETTING_ACCESS) {
      console.error('Attempting to start copy+paste when not getting access');
      return;
    }

    browserified_exports.ui.startGettingInUiAndConfig(null, browserified_exports.ui.copyPastePendingEndpoint);
    browserified_exports.ui.copyPastePendingEndpoint = null;
  },
  switchToGetting: function() {
    this.stopSharing().then(() => {
      if (browserified_exports.ui.copyPasteGettingState === social.GettingState.NONE) {
        this.startGetting();
      }
    });
  },
  stopSharing: function() {
    return browserified_exports.core.stopCopyPasteShare();
  },
  select: function(e :Event, d :Object, sender :HTMLInputElement) {
    sender.focus();
    sender.select();
  },
  dismissError: function() {
    browserified_exports.ui.copyPasteError = ui_constants.CopyPasteError.NONE;
  },
  exitMode: function() {
    // if we are currently in the middle of setting up a connection, end it
    var doneStopping :Promise<void>;
    if (browserified_exports.ui.copyPasteGettingState !== social.GettingState.NONE) {
      doneStopping = this.stopGetting()
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.catch((e) => {
      console.warn('Error while closing getting connection', e);
    }).then(() => {
      if (browserified_exports.ui.copyPasteSharingState !== social.SharingState.NONE) {
        return this.stopSharing();
      }
    }).catch((e) => {
      console.warn('Error while closing sharing connection', e);
    }).then(() => {
      // go back to the previous view regardless of whether we successfully
      // stopped the connection
      browserified_exports.ui.view = ui_constants.View.SPLASH;
    })
  },
  ready: function() {
    this.ui = browserified_exports.ui;
    this.ui_constants = ui_constants;
    this.model = browserified_exports.model;
    this.GettingState = social.GettingState;
    this.SharingState = social.SharingState;
  }
});
