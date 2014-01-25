if (typeof org === 'undefined') var org = {};
if (!org.uproxy) org.uproxy = {};

(function setupSocketProvider(scope) {
  function UninitializedSocket(type, options) {
    if (!(this instanceof UninitializedSocket)) {
      return new UninitializedSocket(type, options);
    }
    this.type = type;
    this.options = options;
  }

  /**
   * A FreeDOM interface to Firefox sockets
   * @constructor
   * @private
   */
  var Socket_firefox = function(channel) {
    this.sid = null;
    this._socketIdCount = 1;
    this._sockets = {};
  };

  Socket_firefox.prototype.create = function(type, options, continuation) {
    var socketId = this._socketIdCount++;
    this._sockets[socketId] = new UninitializedSocket(type, options);
    continuation({socketId: socketId});
  };

  Socket_firefox.prototype.connect = function(socketId, hostname, port, continuation) {
    this._checkSocket(socketId);
    var tempSocket = this._sockets[socketId];
    if (!(tempSocket instanceof UninitializedSocket)) {
      throw new Error('Socket with Id '+ socketId
                      + ' has already been initialized.');
    }
    var clientSocket = new scope.ClientSocket();
    var result;
    try {
      clientSocket.connect(hostname, port, tempSocket.type);
      clientSocket.onData = function(data) {
        this.dispatchEvent('onData',
                           {socketId: socketId,
                            data: data});
      }.bind(this);
      this._sockets[socketId] = clientSocket;
      result = 0;
    } catch (e) {
      result = -1;
    } finally {
      continuation(result);
    }
  };

  Socket_firefox.prototype.write = function(socketId, buffer, continuation) {
    this._checkSocket(socketId);
    var socket = this._sockets[socketId];
    var result;
    try {
      socket.write(buffer);
      result = buffer.length;
    } catch (e) {
      result = -1;
    } finally {
      continuation({bytesWritten: result});
    }
  };

  Socket_firefox.prototype.disconnect = function(socketId, continuation) {
    this._checkSocket(socketId);
    try {
    this._sockets[socketId].disconnect();
    } catch (e) {
      console.warn(e);
    } finally {
      continuation();
    }
  };

  Socket_firefox.prototype.destroy = function(socketId, continuation) {
    // Should we attempt disconnect?
    delete this._sockets[socketId];
    continuation();
  };

  Socket_firefox.prototype.listen = function(socketId, address, port, continuation) {
    this._checkSocket(socketId);
    var tempSocket = this._sockets[socketId];
    if (!(tempSocket instanceof UninitializedSocket)) {
      throw new Error('Socket with Id '+ socketId
                      + ' has already been initialized.');
    }
    var serverSocket = new scope.ServerSocket(address, port);
    serverSocket.onConnect = function(clientSocket) {
      var newSocketId = this._socketIdCount++;
      this._sockets[newSocketId] = clientSocket;
      this.dispatchEvent({serverSocketId: socketId,
                         clientSocketId: newSocketId});
    }.bind(this);

    var listenResult = -2;
    try {
      serverSocket.listen();
      listenResult = 0;
    } catch (e) {
      console.error(e);
    } finally {
      continuation(listenResult);
    }
  };

  Socket_firefox.prototype.getInfo = function(socketId, continuation) {
    var socket = this._sockets[socketId];
    try {
      continuation(socket.getInfo());
    } catch (e) {
      continuation(undefined);
    }
  };

  Socket_firefox.prototype._checkSocket = function(socketId) {
    if (typeof this._sockets[socketId] === 'undefined') {
      throw new Error('Socket with Id ' + socketId + ' does not exist');
    }
  };

  scope.Socket_firefox = Socket_firefox;
})(org.uproxy);
