/*
 * An object oriented wrapper for terminating relayed web requests through a
 * native socket object.
*/
'use strict';

// TODO: write a unit test using this and tcp-server.
(function(exports) {
  var socket = window.socket;

  var NetClientState = {
    CREATING_SOCKET: 'CREATING_SOCKET',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    CLOSED: 'CLOSED'
  }

  // onResponse: function (buffer) { ... }
  // A function to handle the data from a packet that came from the destination.
  //
  // destination: { host : "string", port : number }
  // The destination host and port to connect to.
  var NetClient = function(onResponse, destination) {
    this.socketId = null
    this.onResponse = onResponse;
    this.queue = [];
    this.destination = destination;
    this.state = NetClientState.CREATING_SOCKET;
    socket.create('tcp', {}).done(this._onCreate.bind(this));
  };

  NetClient.prototype._onCreate = function(createInfo) {
    this.socketId = createInfo.socketId;
    if (!this.socketId) {
      console.error("Failed to create socket. createInfo", createInfo);
      return;
    }
    socket.connect(this.socketId, this.destination.host,
        this.destination.port).done(this._onConnected.bind(this));
    this.state = NetClientState.CONNECTING;
  };

  NetClient.prototype._onConnected = function() {
    this.state = NetClientState.CONNECTED;
    socket.on('onData', this._onRead.bind(this));
    if (this.queue.length > 0) {
      this.send(this.queue.shift());
    }
  };

  NetClient.prototype.send = function(buffer) {
    if (this.state == NetClientState.CLOSED) {
      console.warn("Attempted to send data to a closed socket :(");
      return;
    }

    if (this.state == NetClientState.CONNECTED) {
      socket.write(this.socketId, buffer).done(this._onWrite.bind(this));
    } else {
      this.queue.push(buffer);
    }
  };

  NetClient.prototype._onWrite = function(writeInfo) {
    console.log("Bytes written: " + writeInfo.bytesWritten);
    // TODO: change sockets to having an explicit failure rather than giving -1
    // in the bytesWritten field.
    if (writeInfo.bytesWritten < 0) {
      this._onClose();
      return;
    }
    // If there is more to write, write it.
    if (this.queue.length > 0) {
      this.send(this.queue.shift());
    }
  };

  NetClient.prototype._onRead = function(readInfo) {
    if (readInfo.socketId !== this.socketId) {
      // TODO: currently our Freedom socket API sends all messages to every
      // listener. Most crappy. Fix so that we tell it to listen to a
      // particular socket.
      return;
    } else {
      this.onResponse(readInfo.data);
    }
  };

  NetClient.prototype._onClose = function() {
    console.log("Closing socket");
    this.state = NetClientState.CLOSED;
    socket.disconnect(this.socketId).done(this._onClosed.bind(this));
  };

  NetClient.prototype._onClosed = function() {
    if (this.socketId) { socket.destroy(this.socketId); }
    this.socketId = null;
  };

  exports.NetClient = NetClient;
})(window);

