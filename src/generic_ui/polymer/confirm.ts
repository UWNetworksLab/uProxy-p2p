/// <reference path='../scripts/ui.ts' />
declare var ui :UI.UserInterface;

declare var stopProxying :() => void;

Polymer({
  undoProxyConfig: function() {

    stopProxying();
    this.$.confirmButton.disabled = true;
    this.$.proxyReverted.hidden = false;
  }
});
