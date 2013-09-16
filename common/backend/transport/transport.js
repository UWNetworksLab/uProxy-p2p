/*
 * Peer 2 Peer transport provider.
 *
 * TODO: consider if this is actually doing anything useful, or if we should
 * just use core.sctp-peerconnection directly.
 */
console.log("TransportProvider: " + self.location.href);

function TransportProvider() {
  this.peer = freedom['core.sctp-peerconnection']();
  this.peer.on('onMessage', this.message.bind(this));
  this.peer.on('onClose', this.onClose.bind(this));
};

// Called when the peer-connection receives data, it then passes it here.
TransportProvider.prototype.message = function(msg) {
  console.log("TransportProvider.prototype.message: Got Message:"
      + JSON.stringify(msg));
  if (msg.text) {
    this.dispatchEvent('message',
        {"channelid": msg.channelid, "data": msg.text});
  } else if (msg.buffer) {
    this.dispatchEvent('message',
        {"channelid": msg.channelid, "data": msg.buffer});
  } else if (msg.blob) {
    console.error('Blob is not yet supported. ');
  } else {
    console.error('message called without a valid data field');
  }
};

//
TransportProvider.prototype.open = function(freedomChannelId, continuation) {
  var promise = this.peer.setSignallingChannel(freedomChannelId);
  promise.done(continuation);
};

TransportProvider.prototype.send = function(channelid, msg, continuation) {
  var promise;
  if (msg instanceof Blob) {
    console.log("TransportProvider.sending blob");
    promise = this.peer.postMessage({"channelid": channelid, "binary": msg});
  } else if (msg instanceof ArrayBuffer) {
    console.log("TransportProvider.sending ArrayBuffer");
    promise = this.peer.postMessage({"channelid": channelid, "buffer": msg});
  } else if (typeof(msg) === 'string') {
    console.log("TransportProvider.sending text: " + msg);
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

// Note: freedom.transport() does not create a new transport instance here: for
// module definitions freedom.transport() gets the module-constructor-freedom-
// thing.
//
// TODO: change Freedom API so that it distinctly names the module-
// constructor-freedom-thing separately from the thing to create new modules.
var transport = freedom.transport();
transport.provideAsynchronous(TransportProvider);
