/// <reference path='../../interfaces/browser-proxy-config.d.ts'/>
declare var proxyConfig :IBrowserProxyConfig;

Polymer({
	undoProxyConfig: function() {
		//chrome.runtime.sendMessage({confirmedStopProxying: true});
		this.proxyConfig.stopUsingProxy(false);
		this.$.confirmButton.disabled = true;
		this.$.proxyReverted.hidden = false;
	},
  ready: function() {
    this.proxyConfig = proxyConfig;
  }
});
