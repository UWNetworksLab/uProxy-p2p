/*
 * copypaste.ts
 *
 * This file handles the client interactions for the copypaste portion of the
 * app.
 */

function initCopyPaste() {
  ui.view = uProxy.View.COPYPASTE;

  if (GettingState.NONE === ui.copyPasteGettingState) {
    startCopyPasteGetting();
  }
}

function startCopyPasteGetting() {
  var doneStopping :Promise<void>;
  if (ui.copyPasteGettingState !== GettingState.NONE) {
    console.log('aborting previous copy+paste getting connection');
    doneStopping = core.stopCopyPasteGet();
  } else {
    doneStopping = Promise.resolve<void>();
  }

  doneStopping.then(() => {
    ui.copyPasteGettingMessage = '';
    return core.startCopyPasteGet();
  }).then((endpoint) => {
    console.log('started getting connection through copy+paste');
    ui.copyPasteError = UI.CopyPasteError.NONE;
    this.ui.startGettingInUi();
    ui.browserApi.startUsingProxy(endpoint);
  }).catch((e) => {
    // TODO we will see this any time the connection is aborted by the user or
    // when something actually goes wrong with the connection.  We should
    // come up with a good way to differentiate between the two and take
    // appropriate action in those cases.  In most cases, it seems this is not
    // an error, so we are just going to warn about it.

    console.warn('error when starting copy+paste get', e);
    ui.copyPasteError = UI.CopyPasteError.FAILED;
  });
}

Polymer({
  GettingState: GettingState,
  SharingState: SharingState,
  model: model,
  ui: ui,
  UI: UI,
  prev: function() {
    // do not let the user navigate away from this view if copypaste is active
    if (ui.copyPasteGettingState === GettingState.GETTING_ACCESS ||
        ui.copyPasteSharingState === SharingState.SHARING_ACCESS) {
      return;
    }

    ui.view = uProxy.View.SPLASH;
  },
  startGetting: function() {
    startCopyPasteGetting();
  },
  stopGetting: function() {
    core.stopCopyPasteGet();
  },
  switchToGetting: function() {
    core.stopCopyPasteShare().then(() => {
      if (ui.copyPasteGettingState === GettingState.NONE) {
        startCopyPasteGetting();
      }
    });
  },
  stopSharing: function() {
    core.stopCopyPasteShare();
  },
  select: function(e, d, sender) {
    sender.focus();
    sender.select();
  },
  dismissError: function() {
    ui.copyPasteError = UI.CopyPasteError.NONE;
  }
});
