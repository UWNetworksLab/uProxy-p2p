/*
 * copypaste.ts
 *
 * This file handles the client interactions for the copypaste portion of the
 * app.
 */

function initCopyPaste() {
  ui.view = UI.View.COPYPASTE;

  if (GettingState.NONE === ui.copyPasteGettingState) {
    ui.copyPasteGettingMessage = '';
    core.startCopyPasteGet().then((endpoint) => {
      console.log('start getting connection through copy-paste');
      this.ui.startGettingInUi();
      ui.browserApi.startUsingProxy(endpoint);
    }).catch((e) => {
      console.error('error when starting copy paste get', e);
    });
  }
}

Polymer({
  GettingState: GettingState,
  SharingState: SharingState,
  model: model,
  ui: ui,
  prev: function() {
    // do not let the user navigate away from this view if copypaste is active
    if (ui.copyPasteGettingState === GettingState.GETTING_ACCESS ||
        ui.copyPasteSharingState === SharingState.SHARING_ACCESS) {
      return;
    }

    ui.view = UI.View.SPLASH;
  },
  stopGetting: function() {
    core.stopCopyPasteGet();
  },
  stopSharing: function() {
    core.stopCopyPasteShare();
  },
  ready: function() {}
});
