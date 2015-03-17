/*
 * copypaste.ts
 *
 * This file handles the client interactions for the copypaste portion of the
 * app.
 */

Polymer({
  GettingState: GettingState,
  SharingState: SharingState,
  model: model,
  ui: ui,
  UI: UI,
  init: function() {
    /* bring copyPaste to the front in get mode */
    ui.view = uProxy.View.COPYPASTE;

    if (ui.copyPasteGettingState === GettingState.NONE) {
      this.startGetting();
    }
  },
  startGetting: function() {
    var doneStopping :Promise<void>;
    if (ui.copyPasteGettingState !== GettingState.NONE) {
      console.warn('aborting previous copy+paste getting connection');
      doneStopping = this.stopGetting();
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.then(() => {
      ui.copyPasteGettingMessage = '';
      ui.copyPasteError = UI.CopyPasteError.NONE;
      ui.copyPastePendingEndpoint = null;

      return core.startCopyPasteGet();
    }).then((endpoint) => {
      ui.copyPastePendingEndpoint = endpoint;
    }).catch((e) => {
      // TODO we will see this any time the connection is aborted by the user or
      // when something actually goes wrong with the connection.  We should
      // come up with a good way to differentiate between the two and take
      // appropriate action in those cases.  In most cases, it seems this is not
      // an error, so we are just going to warn about it.

      console.warn('error when starting copy+paste get', e);
      ui.copyPasteError = UI.CopyPasteError.FAILED;
    });
  },
  prev: function() {
    // do not let the user navigate away from this view if copypaste is active
    if ((ui.copyPasteGettingState === GettingState.GETTING_ACCESS && ui.copyPastePendingEndpoint === null) ||
        ui.copyPasteSharingState === SharingState.SHARING_ACCESS) {
      return;
    }

    if (ui.copyPasteGettingState === GettingState.NONE &&
        ui.copyPasteSharingState === SharingState.NONE) {
      ui.view = uProxy.View.SPLASH;
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
    return core.stopCopyPasteGet().then(() => {
      // clean up the pending endpoint in case we got here from going back
      ui.copyPastePendingEndpoint = null;
    });
  },
  startProxying: function() {
    if (!ui.copyPastePendingEndpoint) {
      console.error('Attempting to start copy+paste proxying without a pending endpoint');
      return;
    }

    if (ui.copyPasteGettingState !== GettingState.GETTING_ACCESS) {
      console.error('Attempting to start copy+paste when not getting access');
      return;
    }

    this.ui.startGettingInUi();
    ui.browserApi.startUsingProxy(ui.copyPastePendingEndpoint);
    ui.copyPastePendingEndpoint = null;
  },
  switchToGetting: function() {
    this.stopSharing().then(() => {
      if (ui.copyPasteGettingState === GettingState.NONE) {
        this.startGetting();
      }
    });
  },
  stopSharing: function() {
    return core.stopCopyPasteShare();
  },
  select: function(e, d, sender) {
    sender.focus();
    sender.select();
  },
  dismissError: function() {
    ui.copyPasteError = UI.CopyPasteError.NONE;
  },
  doBack: function() {
    // if we are currently in the middle of setting up a connection, end it
    var doneStopping :Promise<void>;
    if (ui.copyPasteGettingState !== GettingState.NONE) {
      doneStopping = this.stopGetting()
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.catch((e) => {
      console.warn('Error while closing getting connection', e);
    }).then(() => {
      if (ui.copyPasteSharingState !== SharingState.NONE) {
        return this.stopSharing();
      }
    }).catch((e) => {
      console.warn('Error while closing sharing connection', e);
    }).then(() => {
      // go back to the previous view regardless of whether we successfully
      // stopped the connection
      ui.view = uProxy.View.SPLASH;
    })
  }
});
