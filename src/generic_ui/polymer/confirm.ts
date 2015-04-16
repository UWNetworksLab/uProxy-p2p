Polymer({
  undoProxyConfig: function() {
    stopProxying();
    this.$.confirmButton.disabled = true;
    this.$.proxyReverted.hidden = false;
  }
});
