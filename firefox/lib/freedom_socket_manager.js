'use strict';

const { Socket, ClientSocket, ServerSocket } = require('./sockets/sockets');

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

var FreedomSocketManager = function(freedomWindow) {
  const sockets = [];

  // Given a socket id, it returns a function that notifies the
  // FreeDOM component when data is received.
  function onDataManager(clientSocketId) {
    return function dataReceived(data) {
      var dataMessage = {socketId: clientSocketId,
                       data: arrayBufferToString(data)};
      freedomWindow.port.emit('socket-data', dataMessage);
      };
  }

  freedomWindow.port.on('socket-create', function socketCreate(args) {
    var socketNumber = sockets.push(Socket()) - 1;
    freedomWindow.port.emit('socket-created', socketNumber);
  });

  freedomWindow.port.on('socket-connect', function socketConnect(args) {
    var socket = sockets[args.socketId];
    // Return zero if no error
    // https://code.google.com/p/chromium/issues/detail?id=157181
    var result;
    try {
      socket.connect(args.hostname, args.port);
      result = 0;
    } catch (e) {
      console.error(e);
      result = -1;
      return;
    } finally {
      freedomWindow.port.emit('socket-connect-response',
			      {socketId: args.socketId,
			       result: result});
    }
    socket.on('onData', onDataManager(args.socketId));
  });

  freedomWindow.port.on('socket-listen', function socketListen(args) {
    var serverSocket = sockets[args.socketId];
    var address = args.address;
    var port = args.port;
    var result;
    try {
      serverSocket.listen(args.address, args.port);
      result = 0;
    } catch (e) {
      console.error(e);
      result = -1;
      return;
    } finally {
      freedomWindow.port.emit('socket-listen-response',
                              {socketId: args.socketId,
                               result: result});
    }
    serverSocket.on('onConnect', function onConnect(clientSocket) {
      var clientSocketId = sockets.push(clientSocket) - 1;
      clientSocket.on('onData', onDataManager(clientSocketId));
      freedomWindow.port.emit('socket-connected',
                              {serverSocketId: args.socketId,
                               clientSocketId: clientSocketId});
    });
    
  });

  freedomWindow.port.on('socket-write', function socketWrite(args) {
    var socket = sockets[args.socketId];
    try {
      socket.write(args.data);
      freedomWindow.port.emit('socket-write-response',
			      {bytesWritten: args.data.length,
			       writes: args.writes,
			       socketId: args.socketId});
    } catch (e) {
      console.warn(e.message);
      freedomWindow.port.emit('socket-write-response',
			      {bytesWritten: -1, writes:args.writes,
			       socketId: args.socketId});
    }
  });

  freedomWindow.port.on('socket-disconnect', function socketDisconnect(args) {
    var socket = sockets[args.socketId];
    socket.disconnect();
    freedomWindow.port.emit('socket-disconnected', {socketId: args.socketId});
  });

  freedomWindow.port.on('socket-info', function socketInfo(args) {
    var socket = sockets[args.socketId];
    var info = socket.getInfo();
    var result = {socketId: args.socketId,
                  infoCall: args.infoCall,
                  info: info};
    freedomWindow.port.emit('socket-info-response', result);
  });
};

exports.FreedomSocketManager = FreedomSocketManager;
