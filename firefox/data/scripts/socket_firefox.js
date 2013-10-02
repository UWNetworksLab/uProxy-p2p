'use strict';

console.log('socket_firefox.js loaded');

/**
 * A FreeDOM interface to Firefox sockets.
 * Communicates with the freedom socket manager in the extension.
 * @constructor
 * @private
 */

var Socket_firefox = function(channel) {
  this.appChannel = channel;
  var createCallbacks = [];
  var connectingSockets = {};
  var disconnectingSockets = {};
  var pendingWrites = {};
  var listeningSockets = {};
  var pendingInfo = {};
  // Exernal socket ids are used by the freedom socket manager,
  // internal socket ids are used by Socket_firefox, the directo
  // socket provider to freedom.
  var externalToInternal = {};
  var internalToExternal = {};
  var currentExternalId = 1;

  function arrayBufferToString(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  function stringToArrayBuffer(str) {
    var buf = new ArrayBuffer(str.length); 
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

  /**
   * Ensure that the given socketId is a number
   */
  function checkId(socketId) {
    if (typeof socketId !== 'number') {
      throw new TypeError('socketId should be a number, got: '
                          + typeof socketId);
    }
  }

  /**
   * Allocate a new external socketId for the given internal id.
   * @param {number} the internal socket to allocate an external socket id for.
   * @return {number} the external socket now associated with the internal id.
   */ 
  function allocateId(internalSocketId) {
    checkId(internalSocketId);
    var externalSocketId = currentExternalId++;
    externalToInternal[externalSocketId] = internalSocketId;
    internalToExternal[internalSocketId] = externalSocketId;
    return externalSocketId;
  }

  /**
   * Get the internal socket id for the given external id.
   * @param {number} the external socket id
   * @return {number} the internal socket id associated with the external id.
   */ 
  function getInternalId(externalSocketId) {
    checkId(externalSocketId);
    return externalToInternal[externalSocketId];
  }

  /**
   * Get the external socket id for the given internal id.
   * @param {number} the internal socket id
   * @return {number} the external socket id associated with the internal id.
   */ 
  function getExternalId(internalSocketId) {
    checkId(internalSocketId);
    return internalToExternal[internalSocketId];
  }

  this.create = function(type, options, callback) {
    console.log('requesting socket creation');
    createCallbacks.push(callback);
    addon.port.emit('socket-create', {type: type, options: options});
  };
  addon.port.on('socket-created', function(socketId) {
    console.log('socket created');
    createCallbacks.pop()({socketId: allocateId(socketId)});
  });

  this.connect = function(socketId, hostname, port, callback) {
    socketId = getInternalId(socketId);
    connectingSockets[socketId] = callback;
    addon.port.emit('socket-connect',
        {socketId: socketId, hostname: hostname, port:port});
  };
  addon.port.on('socket-connect-response', function(response) {
    connectingSockets[response.socketId]({result: response.result});
  });

  addon.port.on('socket-data', function (data) {
    data.data = stringToArrayBuffer(data.data);
    data.socketId = getExternalId(data.socketId);
    this.dispatchEvent('onData', data);
  }.bind(this));

  this.write = function(socketId, data, callback) {
    socketId = getInternalId(socketId);
    if ((typeof pendingWrites[socketId]) === 'undefined') {
      pendingWrites[socketId] = {writes: 0};
    }
    var socketWrites = pendingWrites[socketId];
    // Each call back is associated with its write# so we can find it later
    var writes = socketWrites['writes']++;
    socketWrites[writes] = callback;
    addon.port.emit('socket-write',
        {socketId: socketId, data: arrayBufferToString(data), writes: writes});
  };

  addon.port.on('socket-write-response', function (response) {
    var callbackArgs = {
      bytesWritten: response.bytesWritten
    };
    pendingWrites[response.socketId][response.writes](callbackArgs);
    delete pendingWrites[response.socketId][response.writes];
  });


  this.disconnect = function(socketId, callback) {
    socketId = getInternalId(socketId);
    disconnectingSockets[socketId] = callback;
    addon.port.emit('socket-disconnect', {socketId: socketId});
  };

  addon.port.on('socket-disconnected', function(response) {
    disconnectingSockets[response.socketId]();
    delete listeningSockets[response.socketId];
  });

  this.destroy = function(socketId, callback) {
    this.disconnect(socketId, callback);
  };

  this.listen = function (socketId, address, port, callback) {
    socketId = getInternalId(socketId);
    if (listeningSockets[socketId]) {
      throw 'Socket ' + socketId + ' is either listening or registering to listen.';
    }
    addon.port.emit('socket-listen',
                    {socketId: socketId,
                    address: address,
                    port: port});
    listeningSockets[socketId] = callback;
  };

  addon.port.on('socket-listen-response', function socketListenResponse(args){
    var internalId = args.socketId;
    args.socketId = getExternalId(args.socketId);
    listeningSockets[internalId](args);
    listeningSockets[internalId] = true;
  });

  addon.port.on('socket-connected', function socketConnected(socketInfo) {
    socketInfo.serverSocketId = getExternalId(socketInfo.serverSocketId);
    socketInfo.clientSocketId = allocateId(socketInfo.clientSocketId);
    this.dispatchEvent('onConnection', socketInfo);
  }.bind(this));

  this.getInfo = function(socketId, callback) {
    socketId = getInternalId(socketId);
    var infoCallNumber;
    var waitingInfoCalls;
    if (socketId in pendingInfo) {
      waitingInfoCalls = pendingInfo[socketId];
      infoCallNumber = ++waitingInfoCalls.infos;
      waitingInfoCalls[infoCallNumber] = callback;
    } else {
      waitingInfoCalls = {};
      pendingInfo[socketId] = waitingInfoCalls;
      infoCallNumber = 0;
      waitingInfoCalls.infos = infoCallNumber;
      waitingInfoCalls[infoCallNumber] = callback;
    }
    addon.port.emit('socket-info',
                    {socketId: socketId,
                    infoCall: infoCallNumber});
  };

  addon.port.on('socket-info-response', function getInfoResponse(args) {
    var infoCallback = pendingInfo[args.socketId][args.infoCall];
    infoCallback(args.info);
    delete pendingInfo[args.socketId][args.infoCall];
  });
};
