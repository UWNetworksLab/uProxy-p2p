/*
 * An object oriented wrapper for terminating relayed web requests through a
 * native socket object.
*/
'use strict';

(function(exports) {
  var socket = window.socket;

  var webclient = function(onResponse) {
    socket.create('tcp', {}).done(this._onCreate.bind(this));
    this.onResponse = onResponse;
    this.queue = [];
  };

  webclient.prototype._onCreate = function(createInfo) {
    this.socket = createInfo.socketId;
  };

  webclient.prototype.onMessage = function(msg) {
    if (this.state != 'Closed') {
      this.queue.push(msg);
      this._process();
      return true;
    } else {
      return false;
    }
  };

  webclient.prototype._process = function() {
    if (!this.socket) {
      return;
    }
    if (!this.state && this.queue.length) {
      var header = this.queue.shift();
      var connectInfo = this._parseHeader(header);
      if (connectInfo) {
        socket.connect(this.socket, connectInfo.host, connectInfo.port).done(this._onConnected.bind(this));
        this.state = 'Connecting';
      } else {
        this.state = 'Closed';
      }
    } else if (this.state == 'Open' && this.queue.length) {
      //TODO: this won't work if 'write' only partially writes the buffer.
      var buffer = this.queue.pop();
      socket.write(this.socket, buffer).done(this._onWrite.bind(this));
    }
  };

  webclient.prototype._parseHeader = function(header) {
    var connectInfo = {};
    if (header.host) {
      connectInfo.host = header.host;
      connectInfo.port = header.port;
    } else {
      try {
        header = JSON.parse(header);
        if (header.host) {
          connectInfo.host = header.host;
          connectInfo.port = header.port;
        } else {
          return false;
        }
      } catch(e) {
        return false;
      }
    }
    console.log("Connection being made to " + JSON.stringify(connectInfo));
    return connectInfo;
  };

  webclient.prototype._onConnected = function() {
    this.state = 'Open';
    socket.on('onData', this._onRead.bind(this));
    this._process();
  };

  webclient.prototype._onWrite = function(writeInfo) {
    console.log("Bytes written: " + writeInfo.bytesWritten);
    if (writeInfo.bytesWritten < 0) {
      this._onClose();
    } else {
      this._process();
    }
  };

  webclient.prototype._onRead = function(readInfo) {
    if (readInfo.socketId !== this.socket) {
      return;
    } else {
      this.onResponse(readInfo.data);
    }
  };

  webclient.prototype._onClose = function() {
    console.log("Closing socket");
    this.state = 'Closed';
    socket.disconnect(this.socket).done(this._onClosed.bind(this));
  };

  webclient.prototype._onClosed = function() {
    socket.destroy(this.socket);
  };

  exports.webclient = webclient;

})(window);
