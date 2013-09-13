'use strict';

/**
 * A FreeDOM interface to Firefox sockets
 * @constructor
 * @private
 */

var Socket_firefox = function(channel) {
  this.appChannel = channel;
  var createCallbacks = [];
  var connectingSockets = {};
  var disconnectingSockets = {};
  var pendingReads = {};
  var pendingWrites = {};

  this.create = function(type, options, callback) {
    createCallbacks.push(callback);
    addon.port.emit('socket-create', {type: type, options: options});
  };
  addon.port.on('socket-created', function(socketId) {
    createCallbacks.pop()({socketId: socketId});
  });

  this.connect = function(socketId, hostname, port, callback) {
    connectingSockets[socketId] = callback;
    addon.port.emit('socket-connect',
		    {socketId: socketId, hostname: hostname, port:port});
  };
  addon.port.on('socket-connect-response', function(response) {
    connectingSockets[response.socketId]({result: response.result});
  });

  this.read = function(socketId, bufferSize, callback) {
    if ((typeof pendingReads[socketId]) === 'undefined') {
      pendingReads[socketId] = {reads: 0};
    }
    var socketReads = pendingReads[socketId];
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
    pendingReads[response.socketId][response.reads](callbackArgs);
    // Delete to prevent memory leaks, the callback may have a lot of 'stuff'
    // in its enclosure that the GC can't remove because of the callback.
    delete pendingReads[response.socketId][response.reads];
  });

  this.write = function(socketId, data, callback) {
    if ((typeof pendingWrites[socketId]) === 'undefined') {
      pendingWrites[socketId] = {writes: 0};
    }
    var socketWrites = pendingWrites[socketId];
    // Each call back is associated with its write# so we can find it later
    var writes = socketWrites['writes']++;
    socketWrites[writes] = callback;
    addon.port.emit('socket-write',
		    {socketId: socketId, data: data, writes: writes});
  };

  addon.port.on('socket-write-response', function (response) {
    var callbackArgs = {
      bytesWritten: response.bytesWritten
    };
    pendingWrites[response.socketId][response.writes](callbackArgs);
    delete pendingWrites[response.socketId][response.writes];
  });


  this.disconnect = function(socketId, callback) {
    disconnectingSockets[socketId] = callback;
    addon.port.emit('socket-disconnect', {socketId: socketId});
  };
  
  addon.port.on('socket-disconnected', function(response) {
    disconnectingSockets[response.socketId]();
  });

  this.destroy = function(socketId, callback) {
    this.disconnect(socketId, callback);
  };
};
