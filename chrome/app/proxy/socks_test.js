// socks_test.js
'use strict';

var socksServer = new window.SocksServer("127.0.0.1", 9999,
    function (socksClientConnection, address, port,
              connectedToDestinationCallback) {

      var clientTcpConnection = socksClientConnection.tcpConnection;
      var clientSocketId = clientTcpConnection.socketId;

      if(socksClientConnection.result.cmd == SocksUtil.REQUEST_CMD.CONNECT) {
        chrome.socket.create("tcp", null, function (createInfo) {
          // Socket is now created.
          var destConnected = false;
          var destSocketId = createInfo.socketId;

          var disconnect = function () {
            if (!destConnected) return;
            chrome.socket.disconnect(destSocketId);
            chrome.socket.destroy(destSocketId);
            destConnected = false;
            if(clientTcpConnection.isConnected)
              clientTcpConnection.disconnect();
          };

          chrome.socket.connect(destSocketId,
              socksClientConnection.result.addressString,
              socksClientConnection.result.port, function() {
                destConnected = true;
                // Socket is now connected.

                // When we get data from client, send it to dest.
                clientTcpConnection.on('recv', function(buffer) {

                  console.log('%s: got data: %s', JSON.stringify(clientTcpConnection.state()),
                    getStringOfArrayBuffer(buffer));

                  //try {
                    if(!destConnected) {
                      clientTcpConnection.disconnect();
                      return;
                    }
                    console.log('SocksDestConnection(%d -> %d): %d bytes.',
                      clientSocketId, destSocketId,
                      buffer.byteLength);
                    // TODO: send to destination, e.g. via webrtc, direct tcp
                    // socket.
                    chrome.socket.write(destSocketId, buffer, function () {
                      console.log('SocksDestConnection(%d): %d bytes.', clientSocketId, buffer.byteLength);
                    });
                  //} catch(err) {
                    // TODO: send error back to socks somehow?
                  //  console.error("error trying to send data to destination: ", err);
                  //}
                });

                clientTcpConnection.on('disconnect', function(connection) {
                  console.log('SocksDestConnection(%d -> %d): client closed',
                      clientSocketId, destSocketId);
                  disconnect();
                });

                // Called when we get data from destination to be given
                // to client.
                var onRead = function(readInfo) {
                  if (readInfo.resultCode < 0) {
                    console.warn('SocksDestConnection(%d -> %d): resultCode: %d. Disconnecting', clientSocketId, destSocketId, readInfo.resultCode);
                    disconnect();
                    return;
                  } else if (readInfo.resultCode == 0) {
                    disconnect();
                    return;
                  }

                  if(clientTcpConnection.isConnected) {
                    console.log("SocksDestConnection(%d -> %d): Got data from destination, sending it to the client (%d bytes).", clientSocketId, destSocketId, readInfo.resultCode);
                    clientTcpConnection.sendRaw(readInfo.data);
                  }
                  if(destConnected) {
                    // chrome.socket.read(socketId, null, onRead);
                    chrome.socket.read(destSocketId, null, onRead);
                  }
                }
                chrome.socket.read(destSocketId, null, onRead);

                // Get socket info to tell socks client the final port/IP we
                // connected to.
                chrome.socket.getInfo(destSocketId, function(socketInfo) {
                  // We now have socket Info. Now we tell client that connection
                  // success details.
                  var connectionDetails = {
                    ipAddrString: socketInfo.peerAddress,
                    port: socketInfo.peerPort
                  }
                  connectedToDestinationCallback(connectionDetails);
                }); // socket.getInfo
          }); // socket.connect
        }); // socket.create
      }  // if SocksUtil.REQUEST_CMD.CONNECT
}); //

console.log("Starting test...");
socksServer.tcpServer.listen();
