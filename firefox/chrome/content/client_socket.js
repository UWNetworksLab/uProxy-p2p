if (typeof org === 'undefined') var org = {};
if (!org.uproxy) org.uproxy = {};
console.log('loading client socket');

(function setupClientSockets(scope) {
  var socketTransportService = Components.classes["@mozilla.org/network/socket-transport-service;1"]
        .getService(Components.interfaces.nsISocketTransportService);
  const mainThread = Cc["@mozilla.org/thread-manager;1"].getService().mainThread;

  function arrayBufferToString(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  /*
   * Waits for data/disconnect on a nsIAsyncInputStream
   * stream. ClientSocket isn't used as the callback to exporting
   * onInputStreamReady into the public API of ClientSocket.
   */
  function nsIInputStreamCallback(clientSocket) {
    if (!(this instanceof nsIInputStreamCallback)) {
      return new nsIInputStreamCallback(clientSocket);
    }
    this.socket = clientSocket;
    clientSocket.rawInputStream.asyncWait(this, 0, 0, mainThread);
  }

  nsIInputStreamCallback.prototype.onInputStreamReady = function(stream) {
    var binaryReader = this.socket.binaryReader;
    try {
      var bytesAvailable = binaryReader.available();
    } catch (e) {
      // The error name is NS_BASE_STREAM_CLOSED if the connection
      // closed normally.
      if (e.name !== 'NS_BASE_STREAM_CLOSED') {
        console.warn(e);
      }
      this.socket.disconnect();
      return;
    }

    var lineData = binaryReader.readByteArray(bytesAvailable);
    var buffer = ArrayBuffer(lineData.length);
    var typedBuffer = new Uint8Array(buffer);
    typedBuffer.set(lineData);

    if (typeof this.socket.onData === 'function') {
      this.socket.onData(typedBuffer);
    }
    this.socket.rawInputStream.asyncWait(this, 0, 0, mainThread);
  };

  function ClientSocket(incomingTransport) {
    if (!(this instanceof ClientSocket)) {
      return new ClientSocket(incomingTransport);
    }
    if (typeof incomingTransport !== 'undefined') {
      this._setupTransport(incomingTransport);
    }
  }

  ClientSocket.prototype._setupTransport = function(transport) {
    this.transport = transport;

    // Set up readers
    this.binaryReader = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(Components.interfaces.nsIBinaryInputStream);
    this.rawInputStream = this.transport.openInputStream(0,0,0);
    this.binaryReader.setInputStream(this.rawInputStream);

    new nsIInputStreamCallback(this);

    // set up writers
    this.outputStream = transport.openOutputStream(0, 0, 0);

  }

  ClientSocket.prototype.connect = function(hostname, port, socketType) {
    if (typeof this.transport !== 'undefined') {
      throw new Error('Socket already connected');
    }
    if (typeof socketType === 'undefined' 
        || socketType === 'tcp') {
      socketType = null;
    }
    var transport = socketTransportService.createTransport([socketType],
                                                           0,
						           hostname,
                                                           port,
                                                           null);
    this._setupTransport(transport);
    this.socketType = socketType || 'tcp';
  };

  // TODO: This writ is happening async, so result should be returned async
  ClientSocket.prototype.write = function(data) {
    var stringData = arrayBufferToString(data);
    this.outputStream.write(stringData, stringData.length);
  };

  ClientSocket.prototype.disconnect = function() {
    this.binaryReader.close(0);
    this.rawInputStream.close(0);
    this.transport.close(0);
    // Delete transport so getInfo doesn't think we are connected
    delete this.transport; 
    if (typeof this.onDisconnect === 'function') {
      this.onDisconnect();
    }
  };

  ClientSocket.prototype.getInfo = function() {
    var transport = this.transport;

    if (typeof transport === 'undefined') {
      return {socketType: this.socketType,
              connected: false};
    }
    var nsINetAddrPeer = transport.getScriptablePeerAddr();
    var nsINetAddrLocal = transport.getScriptableSelfAddr();
    var info = {socketType: this.socketType,
                connected: true,
                peerAddress: nsINetAddrPeer.address,
                peerPort: nsINetAddrPeer.port,
                localAddress: nsINetAddrLocal.address,
                localPort: nsINetAddrLocal.port};
    return info;
    
  };

  scope.ClientSocket = ClientSocket;
})(org.uproxy);
