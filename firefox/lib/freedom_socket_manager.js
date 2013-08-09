'use strict';

const { ClientSocket } = require('./sockets');


var FreedomSocketManager = function(freedomWindow) {
  const sockets = [];

  freedomWindow.port.on('socket-create', function socketCreate(args) {
    var socketNumber = sockets.push(ClientSocket()) - 1;
    freedomWindow.port.emit('socket-created', socketNumber);
  });

  freedomWindow.port.on('socket-connect', function socketConnect(args) {
    var socket = sockets[args.socketId];
    try {
      socket.connect(args.hostname, args.port);
      // Return zero if no error
      // https://code.google.com/p/chromium/issues/detail?id=157181
      freedomWindow.port.emit('socket-connect-response',
			       {socketId: args.socketId,
				result: 0});
    } catch (e) {
      console.error(e);
      freedomWindow.port.emit('socket-connect-response',
			       {socketId: args.socketId,
				result: -1});
    }
  });

  freedomWindow.port.on('socket-read', function socketRead(args) {
    var socket = sockets[args.socketId];
    try {
      let data = socket.read(args.bufferSize);
      freedomWindow.port.emit('socket-read-response',
			      {data: data, resultCode: 0, reads: args.reads,
			      socketId: args.socketId});
    } catch (e) {
      freedomWindow.port.emit('socket-read-response', {resultCode: -1,
						       reads: args.reads,
						       socketId: args.socketId});
    }
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
};

exports.FreedomSocketManager = FreedomSocketManager;
