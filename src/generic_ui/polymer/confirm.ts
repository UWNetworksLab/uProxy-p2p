/// <reference path='../scripts/ui.ts' />
declare var ui :UI.UserInterface;

Polymer({
  undoProxyConfig: function() {
    this.ui.stopGettingInUiAndConfig(false);
    this.$.confirmButton.disabled = true;
    this.$.proxyReverted.hidden = false;
  },
  ready: function() {
    // Expose global ui object in this context.
    this.ui = ui;
  }
});
