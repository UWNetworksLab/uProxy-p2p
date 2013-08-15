'use strict';

const { Class } = require('sdk/core/heritage');
const { isUndefined, isNumber, isFunction } = require('sdk/lang/type');
const { Cc, Ci, CC, Cr } = require('chrome');
const { ByteReader, ByteWriter } = require('sdk/io/byte-streams');

const socketTransportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);

// Private variables for sockets get stored in WeakMaps
// Client socket variables
let transports = new WeakMap();
let readers = new WeakMap();
let writers = new WeakMap();

// Server socket variables
let serverSockets = new WeakMap();
let waitingConnections = new WeakMap();
let waitingAccepts = new WeakMap();

function transportFor(socket) transports.get(socket)
function readerFor(socket) readers.get(socket)
function writerFor(socket) writers.get(socket)

function serverSocketFor(socket) serverSockets.get(socket)
function waitingConnectionsFor(socket) waitingConnections.get(socket)
function waitingAcceptsFor(socket) waitingAccepts.get(socket)

var setTransport = function(socket, transport) {
  if (!isUndefined(transportFor(socket))) {
    throw 'Socket already connected';
  }
  // Requires new, unlike the rest of the Jetpack API
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=902222
  reader = new ByteReader(transport.openInputStream(0,0,0));
  writer = new ByteWriter(transport.openOutputStream(0,0,0));

  transports.set(socket, transport);
  readers.set(socket, reader);
  writers.set(socket, writer);
};

var ClientSocket = Class({
  initialize: function initialize(transport) {
    if (!isUndefined(transport)) {
      setTransport(this, transport);
    }
  },
  type: 'ClientSocket',
  connect: function connect(hostname, port) {
    if (!isUndefined(transportFor(socket))) {
      throw 'Socket already connected';
    }
    transport = socketTransportService.createTransport(null, 0,
						       hostname, port, null);
    initializeReaderWriter(transport);
  },
  read: function(numBytes) {
    let reader = readerFor(this);
    return reader.read(numBytes);
  },
  write: function(data) {
    let writer = writerFor(this);
    writer.write(data);
  },
  disconnect: function() {
    [readerFor(this),
     writerFor(this),
     transportFor(this)].forEach(function close(stream) {
       stream.close(0);
     });
  }
});

var nsIServerSocketListener = Class({
  initialize: function initialize(serverSocket) {
    this.serverSocket = serverSocket;
  },
  type: 'nsIServerSocketListener',
  onSocketAccepted: function onSocketAccepted(nsiServerSocket, transport) {
    let clientSocket = ClientSocket(transport);
    if (!isUndefined(waitingAcceptsFor(this.serverSocket))) {
      waitingAcceptsFor(this.serverSocket)(clientSocket);
      waitingAccepts.put(this.serverSocket, undefined);
    } else {
      waitingConnectionsFor(this.serverSocket).push(clientSocket);
    }
  },
  onStopListening: function onStopListening(nsiServerSocket, status) {
    
  }
});

var ServerSocket = Class({
  // Address is currently ignored
  initialize: function initialize(address, port, backlog) {
    if (!isNumber(backlog)) {
      backlog = -1;
    }
    var nsiServerSocket = Cc["@mozilla.org/network/server-socket;1"]
          .createInstance(Ci.nsIServerSocket);
    nsiServerSocket.init(port, 0, backlog);
    nsiServerSocket.put(this, serverSocket);
    waitingConnections.put(this, []);
  },
  type: 'ServerSocket',
  listen: function listen() {
    let serverSocket = serverSocketFor(this);
    serverSocket.asyncListen(nsIServerSocketListener(this));
  },
  accept: function accept(callback) {
    waitingConnections = waitingConnectionsFor(this);
    if (waitingConnections.length > 0) {
      callback(waitingConnections.shift());
    } else if (isUndefined(waitingAcceptsFor(this))) {
      waitingAccepts.put(this, callback);
    }
  },
  disconnect: function disconnect() {
    serverSocketFor(this).close();
  }
});

var copyFunctions = function(source, destination) {
  for (prop in source) {
    if (isFunction(source[prop])) {
      destination[prop] = function () {
	source[prop].apply(source, arguments);
      };
    }
  }
};

var Socket = Class({
  
});

exports.ClientSocket = ClientSocket;
exports.Socket = Socket;
