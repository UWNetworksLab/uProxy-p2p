'use strict';

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

  function stringToArrayBuffer(str) {
    var buf = new ArrayBuffer(str.length); 
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

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

  addon.port.on('socket-data', function (data) {
    data.data = stringToArrayBuffer(data.data);
    this.dispatchEvent('onData', data);
  }.bind(this));

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
    delete listeningSockets[response.socketId];
  });

  this.destroy = function(socketId, callback) {
    this.disconnect(socketId, callback);
  };

  this.listen = function (socketId, address, port, callback) {
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
    listeningSockets[args.socketId](args);
    listeningSockets[args.socketId] = true;
  });

  addon.port.on('socket-connected', function socketConnected(socketInfo) {
    this.dispatchEvent('onConnection', socketInfo);
  }.bind(this));

  this.getInfo = function(socketId, callback) {
    var infoCallNumber;
    if (socketId in pendingInfo) {
      let waitingInfoCalls = pendingInfo[socketId];
      infoCallNumber = ++waitingInfoCalls.infos;
      waitingInfoCalls[infoCallNumber] = callback;
    } else {
      let waitingInfoCalls = {};
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
