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
