/*
Copyright 2013 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Author: Lucas Dixon (ldixon@google.com)
Based on tcp-server.js code by: Renato Mangini (mangini@chromium.org)
*/
'use strict';

/**
 * Converts an array buffer to a string of hex codes and interpretations as
 * a char code.
 *
 * @param {ArrayBuffer} buf The buffer to convert.
 */
function getHexStringOfArrayBuffer(buf) {
  var uInt8Buf = new Uint8Array(buf);
  var a = [];
  for (var i = 0; i < buf.byteLength; ++i) {
    a.push(uInt8Buf[i].toString(16));
  }
  return a.join('.');
}

/**
 * Converts an array buffer to a string of hex codes and interpretations as
 * a char code.
 *
 * @param {ArrayBuffer} buf The buffer to convert.
 */
function getStringOfArrayBuffer(buf) {
  var uInt8Buf = new Uint8Array(buf);
  var s = '';
  for (var i = 0; i < buf.byteLength; ++i) {
    s += String.fromCharCode(uInt8Buf[i]);
  }
  return s;
}


(function(exports) {

  var DEFAULT_MAX_CONNECTIONS = 50;

  // Define some local variables here.
  var socket = chrome.socket || chrome.experimental.socket;

  /**
   * Create an instance of the server
   *
   * @param {Object} options Options of the form { maxConnections: integer,
   * allowHalfOpen: bool }.
   */
  function TcpServer(server_address, port, options) {
    this.addr = server_address;
    this.port = port;
    this.maxConnections = typeof(options) != 'undefined' &&
        options.maxConnections || DEFAULT_MAX_CONNECTIONS;

    // Callback functions.
    this.callbacks = {
      listening: null,  // Called when server starts listening for connections.
      connection: null, // Called when a new socket connection happens.
      disconnect: null  // Called when server stops listening for connections.
    };

    // Default callbacks for when we create new TcpConnections.
    this.connectionCallbacks = {
      disconnect: null, // Called when a socket is disconnected.
      recv: null,       // Called when server receives data.
      sent: null,       // Called when server has sent data.
      // Called when a tcpConnection belonging to this server is created.
      created: this.addToServer.bind(this),
      // Called when a tcpConnection belonging to this server is removed.
      removed: this.removeFromServer.bind(this)
    };

    // Sockets open
    this.openConnections = {};

    // Server socket (accepts and opens one socket per client)
    this.serverSocketId = null;
  }

  /**
   *
   */
  TcpServer.prototype.addToServer = function(tcpConnection) {
    this.openConnections[tcpConnection.socketId] = tcpConnection;
  };

  /**
   *
   */
  TcpServer.prototype.removeFromServer = function(tcpConnection) {
    delete this.openConnections[tcpConnection.socketId];
  };

  /**
   * Static method to return available network interfaces.
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-getNetworkList
   *
   * @param {Function} callback The function to call with the available network
   * interfaces. The callback parameter is an array of
   * {name(string), address(string)} objects. Use the address property of the
   * preferred network as the addr parameter on TcpServer contructor.
   */
  TcpServer.getNetworkAddresses = function(callback) {
    socket.getNetworkList(callback);
  };

  /**
   * Static method to return available network interfaces.
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-getNetworkList
   *
   * @param {Function} callback The function to call with the available network
   * interfaces. The callback parameter is an array of
   * {name(string), address(string)} objects. Use the address property of the
   * preferred network as the addr parameter on TcpServer contructor.
   */
  TcpServer.prototype.isConnected = function() {
    return this.serverSocketId > 0;
  };

  /**
   * Set an event handler. See http://developer.chrome.com/trunk/apps/socket.
   * html for more about the events than can happen.
   *
   * 'listening' takes TODO: complete.
   */
  TcpServer.prototype.on = function(eventName, callback) {
    if (eventName in this.callbacks) {
      this.callbacks[eventName] = callback;
    } else {
      console.error('TcpServer: on failed for ' + eventName);
    }
  };

  /**
   * Listens for TCP requests (opens a socket).
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-create
   * @param {Function} callback The function to call on connection.
   */
  TcpServer.prototype.listen = function() {
    socket.create('tcp', {}, this._onCreate.bind(this));
  };

  /**
   * Disconnects from the remote side
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-disconnect
   */
  TcpServer.prototype.disconnect = function() {
    if (this.serverSocketId) socket.disconnect(this.serverSocketId);
    for (var i in this.openConnections) {
      try {
        this.openConnections[i].disconnect();
        this.removeFromServer(this.openConnections[i]);
      } catch (ex) {
        console.warn(ex);
      }
    }
    socket.disconnect(serverSocketId);
    socket.destory(serverSocketId);
    this.serverSocketId = 0;
    this.isListening = false;
    this.callbacks.disconnect && this.callbacks.disconnect();
  };

  /**
   * The callback function used for when we attempt to have Chrome
   * create a socket. If the socket is successfully created
   * we go ahead and start listening for incoming connections.
   *
   * @private
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-connect
   * @param {Object} createInfo The socket details.
   */
  TcpServer.prototype._onCreate = function(createInfo) {
    this.serverSocketId = createInfo.socketId;
    if (this.serverSocketId > 0) {
      socket.listen(this.serverSocketId, this.addr, this.port, null,
        this._onListenComplete.bind(this));
      this.isListening = true;
    } else {
      console.error('TcpServer: create socket failed for %s:%d',
        this.addr, this.port);
    }
  };

  /**
   * The callback function used for when we attempt to have Chrome
   * connect to the remote side. If a successful connection is
   * made then we accept it by opening it in a new socket (accept method)
   *
   * @private
   */
  TcpServer.prototype._onListenComplete = function(resultCode) {
    if (resultCode === 0) {
      socket.accept(this.serverSocketId, this._onAccept.bind(this));
      this.callbacks.listening && this.callbacks.listening();
    } else {
      console.error('TcpServer: accept failed for %s:%d. Resultcode=%d',
          this.addr, this.port, resultCode);
    }
  };

  TcpServer.prototype._onAccept = function(resultInfo) {
    // continue to accept more connections:
    socket.accept(this.serverSocketId, this._onAccept.bind(this));
    var connectionsCount = Object.keys(this.openConnections).length;
    console.log('TcpServer: this.openConnections.length=%d',
        connectionsCount);
    console.log(this);

    if (resultInfo.resultCode === 0) {
      if (connectionsCount >= this.maxConnections) {
        socket.disconnect(resultInfo.socketId);
        socket.destroy(resultInfo.socketId);
        console.warn('TcpServer: too many connections: %d', connectionsCount);
        // TODO: make a callback for this case.
        //this._onNoMoreConnectionsAvailable(resultInfo.socketId);
        return;
      }
      //
      this._createTcpConnection(resultInfo.socketId);
      console.log('TcpServer: Incoming connection created.');
    } else {
      console.error('TcpServer: Incoming connection failure: %d',
          resultInfo.resultCode);
    }
  };

  TcpServer.prototype._createTcpConnection = function(socketId) {
    // Get info about the socket to create the TcpConnection.
    var self = this;
    socket.getInfo(socketId,
      function(socketInfo) {
        var tcpConnection = new TcpConnection(socketId, socketInfo,
                                              self.connectionCallbacks);
        // Connection has been established, so make the connection callback.
        if (self.callbacks.connection) {
          self.callbacks.connection(tcpConnection);
        }
        console.log('TcpServer: client connected.');
    });
  };

  /**
   * Holds a connection to a client
   *
   * @param {number} socketId The ID of the server<->client socket.
   * @param {socketInfo} socketInfo
   * @param {TcpServer.connectionCallbacks} callbacks
   */
  function TcpConnection(socketId, socketInfo, callbacks) {
    this.socketId = socketId;
    this.socketInfo = socketInfo;
    this.callbacks = {};
    this.callbacks.recv = callbacks.recv;
    this.callbacks.diconnect = callbacks.diconnect;
    this.callbacks.sent = callbacks.sent;
    this.callbacks.created = callbacks.created;
    this.callbacks.removed = callbacks.removed;
    this.isConnected = true;
    this.pendingReadBuffer = null;
    this.recvOptions = null;
    this.pendingRead = false;
    this.callbacks.created(this);

    if(this.callbacks.recv) {
      console.log('TcpConnection(%d): calling _read from TcpConnection.',
          this.socketId);
      this._read();
    }
  };

  /**
   * start reading data
   */
  TcpConnection.prototype._read = function() {
    socket.read(this.socketId, null, this._onRead.bind(this));
    this.pendingRead = true;
  }

  /**
   * Set an event handler. See http://developer.chrome.com/trunk/apps/socket.
   * html for more about the events than can happen.
   *
   * When 'recv' callback is null, data is buffered and given to next non-null
   * callback.
   *
   * @param {string} eventName Enumerated instance of valid callback.
   * @param {function} callback Callback function.
   */
  TcpConnection.prototype.on = function(eventName, callback, options) {
    if (eventName in this.callbacks) {
      this.callbacks[eventName] = callback;
      // For receiving, if recv is set to null at some point, we may end up with
      // data in pendingReadBuffer which when it is set to something else,
      // makes the callback with the pending data, and then re-starts reading.
      if(eventName == 'recv' && callback) {
        if(options) { this.recvOptions = options; }
        else { this.recvOptions = null; }

        if (this.pendingReadBuffer) {
          console.log('TcpConnection(%d): calling recv from "on".', this.socketId);
          this._bufferedCallRecv();
        }
        if(!this.pendingRead) this._read();
      }
    } else {
      console.error('TcpConnection(%d): no such event for on: %s',
          this.socketId, eventName);
    }
  };

  /**
   *
   */
  TcpConnection.prototype._bufferedCallRecv = function() {
    if(this.recvOptions && this.recvOptions.minByteLength >
        this.pendingReadBuffer.byteLength) return;

    var tmpBuf = this.pendingReadBuffer;
    this.pendingReadBuffer = null;
    this.callbacks.recv(tmpBuf);
  }

  /**
   * Sends a message down the wire to the remote side
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-write
   * @param {String} msg The message to send.
   * @param {Function} callback The function to call when the message has sent.
   */
  TcpConnection.prototype.send = function(msg, callback) {
    // Register sent callback.
    _stringToArrayBuffer(msg + '\n', function(msg) {
      // TODO: need bind?
      this.sendRaw(msg, callback);
    }.bind(this));
  };

  /**
   * Sends a message pre-formatted into an arrayBuffer.
   *
   * @param {ArrayBuffer} msg The message to send.
   */
  TcpConnection.prototype.sendRaw = function(msg, callback) {
    if(!this.isConnected) {
      console.warn('TcpConnection(%d): sendRaw when disconnected.',
        this.socketId);
      return;
    }
    var realCallback = callback || this.callbacks.sent || function() {};
    socket.write(this.socketId, msg, realCallback);
  };

  /**
   * Disconnects from the remote side
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-disconnect
   */
  TcpConnection.prototype.disconnect = function() {
    if(!this.isConnected) return;
    this.isConnected = false;

    // Temporary variable for disconnect callback.
    var disconnectCallback = this.callbacks.disconnect;

    // Disconnecting removes all callbacks.
    this.callbacks.disconnect = null;
    this.callbacks.recv = null;
    this.callbacks.sent = null;

    // Close the socket.
    //if (this.socketId) {
    socket.disconnect(this.socketId);
    socket.destroy(this.socketId);

    // Make disconnect callback if not null
    disconnectCallback && disconnectCallback(this);

    // Make the callback to remove this from the count held by the tcpServer
    // we are associated with.
    this.callbacks.removed(this);
  };

  TcpConnection.prototype._addPendingData = function(buffer) {
    if (!this.pendingReadBuffer) {
      this.pendingReadBuffer = buffer;
    } else {
      var temp = Uint8Array(this.pendingReadBuffer.byteLength +
                            buffer.byteLength);
      temp.set(new Uint8Array(this.pendingReadBuffer), 0);
      temp.set(new Uint8Array(buffer), this.pendingReadBuffer.byteLength);
      this.pendingReadBuffer = temp.buffer;
    }
  }

  /**
   * Callback function for when data has been read from the socket.
   * Converts the array buffer that is read in to a string
   * and sends it on for further processing by passing it to
   * the previously assigned callback function.
   *
   * @private
   * @see TcpConnection.prototype.addDataReceivedListener
   * @param {Object} readInfo The incoming message.
   */
  TcpConnection.prototype._onRead = function(readInfo) {
    // if we are disconnected, do nothing and stop reading.
    if (readInfo.resultCode < 0) {
      console.warn('TcpConnection(%d): resultCode: %d. Disconnecting',
          this.socketId, readInfo.resultCode);
      this.disconnect();
      return;
    } else if (readInfo.resultCode == 0) {
      this.disconnect();
      return;
    }

    if (this.callbacks.recv) {
      this._addPendingData(readInfo.data);
      console.log('TcpConnection(%d): calling recv from _onRead.', this.socketId);
      this._bufferedCallRecv();

      // We have to check this.callbacks.recv again becuase when it was called,
      // it may have set this.callbacks.recv to null (e.g. to say we no longer
      // want to recieve more data, or because we decided to disconnect)
      if (this.callbacks.recv) {
        this._read();
      } else {
        this.pendingRead = false;
      }
    } else {
      // If we are not receiving more data at the moment, we store the received
      // data in a pendingReadBuffer for the next time this.callbacks.recv is
      // turned on.
      this._addPendingData(readInfo.data);
      this.pendingRead = false;
    }
  };

  /**
   * Callback for when data has been successfully
   * written to the socket.
   *
   * @private
   * @param {Object} writeInfo The outgoing message.
   */
  TcpConnection.prototype._onWriteComplete = function(writeInfo) {
    // Call sent callback.
    if (this.callbacks.sent) {
      this.callbacks.sent(writeInfo);
    }
  };

  TcpConnection.prototype.state = function() {
    return {
      socketId: this.socketId,
      socketInfo: this.socketInfo,
      callbacks: this.callbacks,
      isConnected: this.isConnected,
      pendingReadBuffer: this.pendingReadBuffer,
      recvOptions: this.recvOptions,
      pendingRead: this.pendingRead,
    };
  };

  /**
   * Converts an array buffer to a string
   *
   * @private
   * @param {ArrayBuffer} buf The buffer to convert.
   * @param {Function} callback The function to call when conversion is
   * complete.
   */
  function _arrayBufferToString(buf, callback) {
    var bb = new Blob([new Uint8Array(buf)]);
    var f = new FileReader();
    f.onload = function(e) {
      callback(e.target.result);
    };
    f.readAsText(bb);
  }

  /**
   * Converts a string to an array buffer
   *
   * @private
   * @param {String} str The string to convert.
   * @param {Function} callback The function to call when conversion is
   * complete.
   */
  function _stringToArrayBuffer(str, callback) {
    var bb = new Blob([str]);
    var f = new FileReader();
    f.onload = function(e) {
        callback(e.target.result);
    };
    f.readAsArrayBuffer(bb);
  }

  exports.TcpServer = TcpServer;
  exports.TcpConnection = TcpConnection;
})(window);
