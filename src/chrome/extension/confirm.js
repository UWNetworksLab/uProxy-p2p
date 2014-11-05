Polymer({
	undoProxyConfig: function() {
		chrome.runtime.onMessage.addListener(
			  function(request, sender, sendResponse) {
			    console.log("response to undo: " + request);
			    if (request.proxyReverted) {
			      this.$.proxyReverted.hidden = false;
			    }
			  }.bind(this));
		chrome.runtime.sendMessage({confirmedStopProxying: true});
		this.$.undoProxyButton.disabled = true;
		this.$.keepProxyButton.disabled = true;
	},
	doNotUndoProxyConfig: function() {
		chrome.runtime.sendMessage({confirmedStopProxying: false});
		this.$.proxyNotReverted.hidden = false;
		this.$.undoProxyButton.disabled = true;
		this.$.keepProxyButton.disabled = true;
	}
});
