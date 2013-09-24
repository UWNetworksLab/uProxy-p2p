const { Cc, Ci, CC, Cr } = require('chrome');
const { Class } = require('sdk/core/heritage');
const { EventTarget } = require("sdk/event/target");
const { emit } = require('sdk/event/core');
const { isUndefined, isNumber, isFunction } = require('sdk/lang/type');
const { ByteReader, ByteWriter } = require('sdk/io/byte-streams');

const socketTransportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
const mainThread = Cc["@mozilla.org/thread-manager;1"].getService().mainThread;

// Private variables for sockets get stored in WeakMaps
let transports = new WeakMap();
let rawReaders = new WeakMap();
let binaryReaders = new WeakMap();
let writers = new WeakMap();
// Map nsIInputStreamCallbacks to their ClientSockets
let streamCallbacks = new WeakMap();

function transportFor(socket) transports.get(socket)
function readerFor(socket) binaryReaders.get(socket)
function rawReaderFor(socket) rawReaders.get(socket)
function writerFor(socket) writers.get(socket)
function clientSocketFor(streamCallback) streamCallbacks.get(streamCallback)

/*
 * Waits for data/disconnect on a nsIAsyncInputStream
 * stream. ClientSocket isn't used as the callback to exporting
 * onInputStreamReady into the public API of ClientSocket.
 */
var nsIInputStreamCallback = Class({
  type: 'SocketReader',
  initialize: function initialize(clientSocket) {
    var rawReader = rawReaderFor(clientSocket);
    streamCallbacks.set(this, clientSocket);
    rawReader.asyncWait(this, 0, 0, mainThread);
  },
  onInputStreamReady: function onInputStreamReady(stream) {
    var clientSocket = clientSocketFor(this);
    var binaryReader = readerFor(clientSocket);
    try {
      var bytesAvailable = binaryReader.available();
    } catch (e) {
      // The error name is NS_BASE_STREAM_CLOSED if the connection
      // closed normally.
      if (e.name !== 'NS_BASE_STREAM_CLOSED') {
        console.warn(e);
      }
      clientSocket.disconnect();
      return;
    }

    var lineData = binaryReader.readByteArray(bytesAvailable);
    var buffer = ArrayBuffer(lineData.length);
    var typedBuffer = new Uint8Array(buffer);
    typedBuffer.set(lineData);

    emit(clientSocket, 'onData', typedBuffer);
    
    var rawReader = rawReaderFor(clientSocket);
    rawReader.asyncWait(this, 0, 0, mainThread);
  }
});

/**
 * Sets up transport and streams for a ClientSocket.
 */
var setTransport = function(socket, transport) {
  if (!isUndefined(transportFor(socket))) {
    throw 'Socket already connected';
  }

  var binaryReader = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
  var rawInputStream = transport.openInputStream(0,0,0);
  binaryReader.setInputStream(rawInputStream);
  // Requires new, unlike the rest of the Jetpack API
  // See https://bugzilla.mozilla.org/show_bug.cgi?id=902222
  var writer = new ByteWriter(transport.openOutputStream(0,0,0));

  transports.set(socket, transport);
  rawReaders.set(socket, rawInputStream);
  binaryReaders.set(socket, binaryReader);
  writers.set(socket, writer);
  nsIInputStreamCallback(socket);
};


var ClientSocket = Class({
  extends: EventTarget,
  type: 'ClientSocket',
  initialize: function initialize(transport, eventOptions) {
    EventTarget.prototype.initialize.call(this, eventOptions);
    if (!isUndefined(transport)) {
      setTransport(this, transport);
    }
  },
  connect: function connect(hostname, port) {
    if (!isUndefined(transportFor(this))) {
      throw 'Socket already connected';
    }

    var transport = socketTransportService.createTransport(null,
                                                           0,
							   hostname,
                                                           port,
                                                           null);
    setTransport(this, transport);
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
    emit(this, 'onDisconnect');
  }
});

exports.ClientSocket = ClientSocket;
