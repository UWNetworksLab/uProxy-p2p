// socks_test.js
'use strict';

var socksServer = new window.SocksServer("127.0.0.1", 9999,
    function (socksClientConnection, address, port,
              connectedToDestinationCallback) {

      var clientTcpConnection = socksClientConnection.tcpConnection;

      if(socksClientConnection.result.cmd == SocksUtil.REQUEST_CMD.CONNECT) {
        chrome.socket.create("tcp", null, function (createInfo) {
          // Socket is now created.
          var destSocketId = createInfo.socketId;
          chrome.socket.connect(destSocketId,
              socksClientConnection.result.addressString,
              socksClientConnection.result.port, function() {
                // Socket is now connected.

                //
                clientTcpConnection.on('recv', function(buffer) {
                  //try {
                    console.log('SocksDestConnection(%d -> %d): %d bytes.',
                      clientTcpConnection.socketId, destSocketId,
                      buffer.byteLength);
                    // TODO: send to destination, e.g. via webrtc, direct tcp
                    // socket.
                    chrome.socket.write(destSocketId, buffer, function () {
                      console.log('SocksDestConnection(%d): %d bytes.', clientTcpConnection.socketId, buffer.byteLength);
                    });
                  //} catch(err) {
                    // TODO: send error back to socks somehow?
                  //  console.error("error trying to send data to destination: ", err);
                  //}
                });

                clientTcpConnection.on('sent', function() {
                  console.log('SocksDestConnection(%d -> %d): data sent to client.',
                      clientTcpConnection.socketId, destSocketId);
                });

                clientTcpConnection.on('disconnect', function(connection) {
                  console.log('SocksDestConnection(%d -> %d): The client closed',
                      clientTcpConnection.socketId, destSocketId);
                  chrome.socket.disconnect(destSocketId);
                  chrome.socket.destroy(destSocketId);
                  destSocketId = null;
                });

                // Called when we get data from destination to be given
                // to client.
                var onRead = function(readInfo) {
                  if (readInfo.resultCode < 0) {
                    console.warn('SocksDestConnection(%d -> %d): resultCode: %d. Disconnecting', clientTcpConnection.socketId, destSocketId, readInfo.resultCode);
                    clientTcpConnection.disconnect();
                    return;
                  } else if (readInfo.resultCode == 0) {
                    clientTcpConnection.disconnect();
                    return;
                  } else {
                    console.log("SocksDestConnection(%d -> %d): Got data from destination, sending it to the client (%d bytes).", clientTcpConnection.socketId, destSocketId, readInfo.resultCode);
                    clientTcpConnection.sendRaw(readInfo.data);
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
                  connectedToDestinationCallback(
                    connectionDetails,
                    function() {
                      // We have now told the socks client that we are connected.
                      /* socksClientConnection.tcpConnection.send(
                          "HTTP/1.0 200 OK\r\n"
                          "Content-Type: text/html\r\n"
                          "Content-Length: 5\r\n\r\n"
                          "hello?");
                      */
                  });
                }); // socket.getInfo
          }); // socket.connect
        }); // socket.create
      }  // if SocksUtil.REQUEST_CMD.CONNECT
}); //

console.log("Starting test...");
socksServer.tcpServer.listen();
