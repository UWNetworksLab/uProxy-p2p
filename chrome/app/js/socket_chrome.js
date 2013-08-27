/**
 * A FreeDOM interface to Chrome sockets
 * TODO(willscott): Refactor into freedom-chrome.
 * @constructor
 * @private
 */
var Socket_chrome = function(channel) {
  this.appChannel = channel;
  this.sid = null;
  this.create = chrome.socket.create;
  this.write = chrome.socket.write;
  this.getInfo = chrome.socket.getInfo;
};

// Error codes can be found at:
// https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

Socket_chrome.prototype.connect = function(socketId, hostname, port, callback) {
  chrome.socket.connect(socketId, hostname, port, function connectCallback(result) {
    callback(result);
    var dataRead = function (readInfo) {
      if (readInfo.resultCode > 0) {
	this.dispatchEvent('onData', {socketId: socketId, data: readinfo.data});
	readLoop();
      } else if (readInfo.resultcode === 0 && readInfo.resultCode === -15) {
	// The result code is -15 if the connection was closed, which can
	// can happen in usual program flow, so we will not log the error.
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
  }.bind(this));
};

Socket_chrome.prototype.listen = function(socketId, address, port, callback) {
  chrome.socket.listen(socketId, address, port, null, function listenCallback(result) {
    callback(result);
    if (result === 0) {
      var acceptCallback = function (acceptInfo) {
	if (acceptInfo.resultCode === 0) {
	  this.dispatchEvent('onConnection', [socketId, acceptInfo.socketId]);
	  acceptLoop();
	} else if (acceptInfo.resultCode !== -15) {
	  console.error('Error ' + acceptInfo.resultCode
			+ ' while trying to accept connection on socket ' + socketId);
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
