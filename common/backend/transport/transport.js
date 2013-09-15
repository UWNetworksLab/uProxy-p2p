function TransportProvider() {
  console.log("Transport Provider");
  this.peer = freedom['core.sctp-peerconnection']();

  this.peer.on('message', this.onMessage.bind(this));
  this.peer.on('onClose', this.onClose.bind(this));
};

TransportProvider.prototype.onMessage = function(m) {
  console.log("Got Message");
  if (m.text) {
    this.dispatchEvent('message', {"channelid": m.channelid, "data": m.text});
  } else if (m.buffer) {
    this.dispatchEvent('message', {"channelid": m.channelid, "data": m.buffer});
  } else if (m.blob) {
    console.error('Blob is not yet supported. Data: ', m);
  } else {
    console.error('onMessage called without any valid data field: ', m);
  }
};

TransportProvider.prototype.open = function(proxy, continuation) {
  var promise = this.peer.open(proxy);
  promise.done(continuation);
};

TransportProvider.prototype.send = function(channelid, msg, continuation) {
  var promise;
  if (msg instanceof Blob) {
    console.log("Transport asking to post blob msg");
    promise = this.peer.postMessage({"channelid": channelid, "binary": msg});
  } else if (msg instanceof ArrayBuffer) {
    console.log("Transport asking to post array buffer msg");
    promise = this.peer.postMessage({"channelid": channelid, "buffer": msg});
  } else if (typeof(msg) === 'string') {
    console.log("Transport asking to post text msg: " + msg);
    promise = this.peer.postMessage({"channelid": channelid, "text": msg});
  } else {
    console.error('Trying to send an unsupported type of object: '
        + typeof(msg));
    return;
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
