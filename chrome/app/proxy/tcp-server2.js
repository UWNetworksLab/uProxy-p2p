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
Based on code by: Renato Mangini (mangini@chromium.org)
*/

const DEFAULT_MAX_CONNECTIONS=50;

(function(exports) {

  var log = console.log;
  var log = console.info;
  var error = console.error;

  // Define some local variables here.
  var socket = chrome.socket || chrome.experimental.socket;

  /**
   * Create an instance of the server
   *
   * @param {Object} options Options of the form { maxConnections: integer,
   * allowHalfOpen: bool }
   * @param {function} connect_callback Called when socket is connected
   */
  function TcpServer(server_address, port, options) {
    this.addr = server_address;
    this.port = port;
    this.maxConnections = typeof(options) != 'undefined'
        && options.maxConnections || DEFAULT_MAX_CONNECTIONS;

    // Callback functions.
    this.callbacks = {
      listening: null,  // Called when server starts listening for connections.
      connection: null, // Called when a new socket connection happens.
      stop: null,       // Called when server stops listening for connections.
      disconnect: null, // Called when a socket is disconnected.
      recv: null,       // Called when server receives data.
      sent: null        // Called when server has sent data.
    };

    // Sockets open
    this.openSockets=[];

    // server socket (one server connection, accepts and opens one socket per client)
    this.serverSocketId = null;

    console.log('initialized tcp server, not listening yet');
  }


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
  TcpServer.getNetworkAddresses=function(callback) {
    socket.getNetworkList(callback);
  }

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
  TcpServer.prototype.isConnected=function() {
    return this.serverSocketId > 0;
  }

  /**
   * Set an event handler. See http://developer.chrome.com/trunk/apps/socket.
   * html for more about the events than can happen.
   *
   * 'listening' takes TODO: complete.
   */
  TcpServer.prototype.on=function(event_name, callback) {
    if(event_name in this.callbacks) {
      this.callbacks[event_name] = callback;
    } else {
      console.error("No such event to be handled: " + event_name);
    }
  }

  /**
   * Listens for TCP requests (opens a socket).
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-create
   * @param {Function} callback The function to call on connection
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
    for (var i=0; i<this.openSockets.length; i++) {
      try {
        this.openSockets[i].disconnect();
      } catch (ex) {
        console.log(ex);
      }
    }
    this.openSockets=[];
    this.serverSocketId=0;
    this.callbacks.stop && this.callbacks.stop();
  };

  /**
   * The callback function used for when we attempt to have Chrome
   * create a socket. If the socket is successfully created
   * we go ahead and start listening for incoming connections.
   *
   * @private
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-connect
   * @param {Object} createInfo The socket details
   */
  TcpServer.prototype._onCreate = function(createInfo) {
    this.serverSocketId = createInfo.socketId;
    if (this.serverSocketId > 0) {
      socket.listen(this.serverSocketId, this.addr, this.port, null,
        this._onListenComplete.bind(this));
      this.isListening = true;
    } else {
      console.error('Unable to create socket');
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
    if (resultCode===0) {
      socket.accept(this.serverSocketId, this._onAccept.bind(this));
      this.callbacks.listening && this.callbacks.listening();
    } else {
      console.error('Unable to listen to socket %s:%d. Resultcode=%d',
          this.addr, this.port, resultCode);
    }
  }

  TcpServer.prototype._onAccept = function(resultInfo) {
    // continue to accept more connections:
    socket.accept(this.serverSocketId, this._onAccept.bind(this));

    if (resultInfo.resultCode===0) {
      if (this.openSockets.length>=this.maxConnections) {
        socket.disconnect(socketId);
        console.error("Disconnected socket (too many connections)");
        //this._onNoMoreConnectionsAvailable(resultInfo.socketId);
        return;
      }
      this._createTcpConnection(resultInfo.socketId);
      console.log('Incoming connection handled.');
    } else {
      console.error('Unable to accept incoming connection. Error code='
          + resultInfo.resultCode);
    }
  }

  TcpServer.prototype._createTcpConnection = function(socketId) {
    // Get info about the socket to create the TcpConnection.
    var self = this;
    socket.getInfo(socketId,
      function(socketInfo) {
        var tcpConnection = new TcpConnection(socketId, socketInfo,
            { disconnect: self.callbacks.disconnect,
              recv: self.callbacks.recv,
              sent: self.callbacks.sent
            });
        self.openSockets.push(tcpConnection);
        // Connection has been established, so make the connection callback.
        if (self.callbacks.connection) {
          self.callbacks.connection(tcpConnection);
        }
        // This is set after connection callback so that the connection
        // callback can create a read-data handler.
        console.log('Established client connection. Listening...');
        socket.read(socketId, null,
            tcpConnection._onDataRead.bind(tcpConnection));
    });
  }

  /**
   * Holds a connection to a client
   *
   * @param {number} socketId The ID of the server<->client socket
   */
  function TcpConnection(socketId, socketInfo, callbacks) {
    this.socketId = socketId;
    this.socketInfo = socketInfo;

    // Callback functions.
    this.callbacks = callbacks || {
      disconnect: null, // Called when socket is disconnected.
      recv: null,       // List of callbacks for when data is received.
      sent: null        // Called sent data to server.
    };
  };

  /**
   * Set an event handler. See http://developer.chrome.com/trunk/apps/socket.
   * html for more about the events than can happen.
   *
   * 'listening' takes TODO: complete.
   */
  TcpConnection.prototype.on=function(event_name, callback) {
    if(event_name in this.callbacks) {
      this.callbacks[event_name] = callback;
    } else {
      console.error("No such event to be handled: " + event_name);
    }
  }

  /**
   * Sends a message down the wire to the remote side
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-write
   * @param {String} msg The message to send
   * @param {Function} callback The function to call when the message has sent
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
	 * @param {ArrayBuffer} msg The message to send
	 */
	TcpConnection.prototype.sendRaw = function(msg, callback) {
    var realCallback = callback || this.callbacks.sent || function() {};
		socket.write(this.socketId, msg, realCallback);
	};

  /**
   * Disconnects from the remote side
   *
   * @see http://developer.chrome.com/trunk/apps/socket.html#method-disconnect
   */
  TcpConnection.prototype.disconnect = function() {
    if (this.socketId) socket.disconnect(this.socketId);
    this.callbacks.disconnect && this.callbacks.disconnect(this);
  };

  /**
   * Callback function for when data has been read from the socket.
   * Converts the array buffer that is read in to a string
   * and sends it on for further processing by passing it to
   * the previously assigned callback function.
   *
   * @private
   * @see TcpConnection.prototype.addDataReceivedListener
   * @param {Object} readInfo The incoming message
   */
  TcpConnection.prototype._onDataRead = function(readInfo) {
    // Call received callback if there's data in the response.
    if (readInfo.resultCode > 0 && this.callbacks.recv) {
      console.log('onDataRead result: %d', readInfo.resultCode);
      this.callbacks.recv(readInfo.data);
    } else {
      console.warn('TcpConnection.prototype._onDataRead: unexpected resultCode: %d', readInfo.resultCode);
      return;
    }

    // Read more data
    socket.read(this.socketId, null, this._onDataRead.bind(this));
  };

  /**
   * Callback for when data has been successfully
   * written to the socket.
   *
   * @private
   * @param {Object} writeInfo The outgoing message
   */
  TcpConnection.prototype._onWriteComplete = function(writeInfo) {
    console.log('onWriteComplete');
    // Call sent callback.
    if (this.callbacks.sent) {
      this.callbacks.sent(writeInfo);
    }
  };

  /**
   * Converts an array buffer to a string
   *
   * @private
   * @param {ArrayBuffer} buf The buffer to convert
   * @param {Function} callback The function to call when conversion is complete
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
   * @param {String} str The string to convert
   * @param {Function} callback The function to call when conversion is complete
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
