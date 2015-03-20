/*
 * copypaste.ts
 *
 * This file handles the client interactions for the copypaste portion of the
 * app.
 */

function initCopyPaste() {
  ui.view = uProxy.View.COPYPASTE;

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
    ui.view = uProxy.View.SPLASH;
  },
  stopGetting: function() {
    core.stopCopyPasteGet();
  },
  stopSharing: function() {
    core.stopCopyPasteShare();
  },
  select: function(e, d, sender) {
    sender.focus();
    sender.select();
  },
  ready: function() {}
});
