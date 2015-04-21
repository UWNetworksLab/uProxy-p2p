declare var stopProxying :Function;

Polymer({
  undoProxyConfig: function() {
    stopProxying();
    this.$.confirmButton.disabled = true;
    this.$.proxyReverted.hidden = false;
  }
});
