function TransportProvider() {
  console.log("Transport Provider");
  this.peer = freedom['core.peerconnection']();

  this.peer.on('message', this.onMessage.bind(this));
  this.peer.on('onClose', this.onClose.bind(this));
};

TransportProvider.prototype.onMessage = function(m) {
  console.log("Got Message");
  if (m.text) {
    this.dispatchEvent('message', {"tag": m.tag, "data": m.text});
  } else {
    this.dispatchEvent('message', {"tag": m.tag, "data": m.buffer});
  }
};

TransportProvider.prototype.open = function(proxy, continuation) {
  var promise = this.peer.open(proxy);
  promise.done(continuation);
};

TransportProvider.prototype.send = function(tag, msg, continuation) {
  var promise;
  if (msg instanceof Blob) {
    console.log("Transport asking to post binary msg");
    promise = this.peer.postMessage({"tag": tag, "binary": msg});
  } else if (msg instanceof ArrayBuffer) {
    console.log("Transport asking to post binary msg");
    promise = this.peer.postMessage({"tag": tag, "binary": new Blob([msg], {"type": "text/plain"})});    
  } else {
    console.log("Transport asking to post text msg: " + msg);
    promise = this.peer.postMessage({"tag": tag, "text": msg});
  }
  promise.done(continuation);
};

TransportProvider.prototype.close = function(continuation) {
  this.peer.close().done(continuation);
};

TransportProvider.prototype.onClose = function() {
  this.dispatchEvent('onClose', null);
}

var transport = freedom.transport();
transport.provideAsynchronous(TransportProvider);
