if (typeof org === 'undefined') var org = {};
if (!org.uproxy) org.uproxy = {};

(function setupServerSockets(scope) {

  function nsIServerSocketListener(serverSocket) {
    if (!(this instanceof nsIServerSocketListener)) {
      return new nsIServerSocketListener(serverSocket);
    }
    this.serverSocket = serverSocket;
  }

  nsIServerSocketListener.prototype.onSocketAccepted = function(nsiServerSocket, transport) {
    let clientSocket = new scope.ClientSocket(transport);
    if(typeof this.serverSocket.onConnect === 'function') {
      this.serverSocket.onConnect(clientSocket);
    }
  };

  nsIServerSocketListener.prototype.onStopListening = function(nsiServerSocket, status) {
  };

  // Address is currently ignored, as it is not possible to specify a
  // listening address in Firefox.
  function ServerSocket(address, port, backlog) {
    if (!(this instanceof ServerSocket)) {
      return new ServerSocket(address, port, backlog);
    }
    if (typeof backlog !== 'number') {
      backlog = -1;
    }
    this.nsIServerSocket = Components.classes["@mozilla.org/network/server-socket;1"]
      .createInstance(Components.interfaces.nsIServerSocket);
    this.nsIServerSocket.init(port, 0, backlog);
  }

  ServerSocket.prototype.listen = function() {
    this.nsIServerSocket.asyncListen(new nsIServerSocketListener(this));
  };

  ServerSocket.prototype.disconnect = function() {
    this.nsIServerSocket.close();
  };

  ServerSocket.prototype.getInfo = function() {
    var nsIServerSocket = this.nsIServerSocket;
    var port = nsIServerSocket.port;
    var localAddress = '127.0.0.1';
    var socketType = 'tcp';
    var info = {socketType: socketType,
                localAddress: localAddress,
                localPort: port};
    return info;
  };
  scope.ServerSocket = ServerSocket;
})(org.uproxy);
