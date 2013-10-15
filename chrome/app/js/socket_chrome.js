/**
 * A FreeDOM interface to Chrome sockets
 * TODO(willscott): Refactor into freedom-chrome.
 * @constructor
 * @private
 */
var Socket_chrome = function(channel) {
  this.appChannel = channel;
  this.sid = null;
  // http://developer.chrome.com/apps/socket.html
  this.create = chrome.socket.create;
  this.write = chrome.socket.write;
  this.getInfo = chrome.socket.getInfo;
};

// Error codes can be found at:
// https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

/*
 * Continuously reads data in from the given socket and dispatches the data to
 * the socket user.
 */
var readSocket = function(socketId) {
  var saved_socketId = socketId;
  var dataRead = function (readInfo) {
    console.log('socket_chrome.js: readSocket(' + JSON.stringify(readInfo) + "): returning ");
    if (readInfo.resultCode > 0) {
      var arg = {socketId: socketId, data: readInfo.data};
      console.log('socket_chrome.js: readSocket(' + saved_socketId + "): returning "
          + JSON.stringify(arg));
      this.dispatchEvent('onData', arg);
      readLoop();
    } else if (readInfo.resultCode === 0 || readInfo.resultCode === -15 ||
        readInfo.resultCode === -2) {
      // The result code is -15 if the connection was closed, which can
      // can happen in usual program flow, so we will not log the error.
      // console.warn('Got a disconnection for socket ' + socketId);
      if (readInfo.resultCode === -2) {
        console.log('HACKITY HACK: Ignoring an unexpected -2 from a socket.  ' +
            'Deal with it later');
      }
      this.dispatchEvent('onDisconnect', {socketId: socketId});
    } else {
      console.error('Error with result code ' + readInfo.resultCode +
		  ' occured when reading from socket ' + socketId);
    };
  }.bind(this);
  var readLoop = function () {
    chrome.socket.read(socketId, null, dataRead);
  };
  readLoop();
};

Socket_chrome.prototype.connect = function(socketId, hostname, port, callback) {
  chrome.socket.connect(socketId, hostname, port, function connectCallback(result) {
    callback(result);
    readSocket.call(this, socketId);
  }.bind(this));
};

Socket_chrome.prototype.listen = function(socketId, address, port, callback) {
  chrome.socket.listen(socketId, address, port, null, function listenCallback(result) {
    callback(result);
    if (result === 0) {
      var acceptCallback = function (acceptInfo) {
	    if (acceptInfo.resultCode === 0) {
	      this.dispatchEvent('onConnection',
			                 {serverSocketId: socketId,
			                  clientSocketId: acceptInfo.socketId});
	      acceptLoop();
	      readSocket.call(this, acceptInfo.socketId);
	    } else if (acceptInfo.resultCode !== -15) {
	      console.error('Error ' + acceptInfo.resultCode
			  + ' while trying to accept connection on socket '
			      + socketId);
	    }
      }.bind(this);
      var acceptLoop = function() {
	    chrome.socket.accept(socketId, acceptCallback);
      };
      acceptLoop();
    }
  }.bind(this));
};

Socket_chrome.prototype.destroy = function(socketId, continuation) {
  if (chrome && chrome.socket) {
    chrome.socket.destroy(socketId);
  }
  continuation();
};

Socket_chrome.prototype.disconnect = function(socketId, continuation) {
  if (chrome && chrome.socket) {
    chrome.socket.disconnect(socketId);
  }
  continuation();
};
