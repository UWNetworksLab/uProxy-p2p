/// <reference path='../../interfaces/browser-proxy-config.d.ts'/>
declare var proxyConfig :IBrowserProxyConfig;

Polymer({
	undoProxyConfig: function() {
		this.proxyConfig.stopUsingProxy(false);
		this.$.confirmButton.disabled = true;
		this.$.proxyReverted.hidden = false;
	},
  ready: function() {
    // Expose global proxyConfig object in this context.
    this.proxyConfig = proxyConfig;
  }
});
