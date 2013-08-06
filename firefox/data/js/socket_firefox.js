'use strict';

/**
 * A FreeDOM interface to Firefox sockets
 * @constructor
 * @private
 */

var Socket_firefox = function(channel) {
  this.appChannel = channel;
  this.createCallbacks = [];
  this.connectingSockets = {};
  this.disconnectingSockets = {};
  this.pendingReads = {};
  this.pendingWrites = {};

  this.create = function(type, options, callback) {
    this.createCallbacks.push(callback);
    addon.port.emit('socket-create', {type: type, options: options});
  };
  addon.port.on('socket-created', function(socketId) {
    this.createCallbacks.pop().call({socketId: socketId});
  });

  this.connect = function(socketId, hostname, port, callback) {
    this.connectingSockets[socketId] = callback;
    addon.port.emit('socket-connect',
		    {socketId: socketId, hostname: hostname, port:port});
  };
  addon.port.on('socket-connect-response', function(response) {
    this.connectingSockets[response.socketId].call({result: response.result});
  });

  this.read = function(socketId, bufferSize, callback) {
    if ((typeof this.pendingReads[socketId]) === 'undefined') {
      this.pendingReads[socketId] = {reads: 0};
    }
    var socketReads = this.pendingReads[socketId];
    // Each call back is associated with its read# so we can find it later
    var reads = socketReads['reads']++;
    socketReads[reads] = callback;
    addon.port.emit('socket-read',
		    {socketId: socketId, bufferSize: bufferSize, reads: reads});
  };
  addon.port.on('socket-read-response', function (response) {
    var callbackArgs = {
      resultCode: response.resultCode,
      data: response.data
      };
    this.pendingReads[response.socketId][response.reads].call(callbackArgs);
    // Delete to prevent memory leaks, the callback may have a lot of 'stuff'
    // in its enclosure that the GC can't remove because of the callback.
    delete this.pendingReads[response.socketId][response.reads];
  });

  this.write = function(socketId, data, callback) {
    if ((typeof this.pendingWrites[socketId]) == 'undefined') {
      this.pendingWrites = {writes: 0};
    }
    var socketWrites = this.pendingWrites[socketId];
    // Each call back is associated with its read# so we can find it later
    var writes = socketWrites['reads']++;
    socketWrites[writes] = callback;
    addon.port.emit('socket-write',
		    {socketId: socketId, data: data, writes: writes});
  };

  addon.port.on('socket-write-response', function (response) {
    var callbackArgs = {
      resultCode: response.resultCode,
      data: response.data
      };
    this.pendingWrites[response.socketId][response.writes].call(callbackArgs);
    delete this.pendingWrites[response.socketId][response.writes];
  });


  this.disconnect = function(socketId, callback) {
    this.disconnectingSockets[socketId] = callback();
    addon.port.emit('socket-disconnect', {socketId: socketId});
  };
  
  addon.port.on('socket-disconnected', function(response) {
    this.disconnectingSockets[response.socketId].call();
  });

  this.destroy = function(socketId, callback) {
    this.disconnect(socketId, callback);
  };
  
};


