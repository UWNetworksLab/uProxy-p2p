// socks_test.js

socksServer = new window.SocksServer("127.0.0.1", 9999,
    function (socksClientConnection, address, port,
          connectedToDestinationCallback) {
      // Implement your own proxy here! Do encryption, tunnelling, whatever! Go flippin' mental!
      // I plan to tunnel everything including SSH over an HTTP tunnel. For now, though, here is the plain proxy:
      var clientTcpConnection = socksClientConnection.tcpConnection;

      if(socksClientConnection.result.cmd == SocksUtil.REQUEST_CMD.CONNECT) {
        chrome.socket.create("tcp", null, function (createInfo) {
          // Socket is now created.
          var socketId = createInfo.socketId;
          chrome.socket.connect(createInfo.socketId,
              socksClientConnection.result.addressString,
              socksClientConnection.result.port, function() {
                // Socket is now connected.

                //
                clientTcpConnection.on('recv', function(buffer) {
                  //try {
                    console.log('received data from client to send to destination: ' + buffer.byteLength + ' bytes.');
                    // TODO: send to destination, e.g. via webrtc, direct tcp
                    // socket.
                    chrome.socket.write(socketId, buffer, function () {
                      console.log("Sent data to destination.")
                    });
                  //} catch(err) {
                    // TODO: send error back to socks somehow?
                  //  console.error("error trying to send data to destination: ", err);
                  //}
                });

                clientTcpConnection.on('sent', function() {
                  console.log('data sent to client.');
                });

                clientTcpConnection.on('disconnect', function(connection) {
                  console.log('The client closed');
                  chrome.socket.disconnect(socketId);
                  chrome.socket.destroy(socketId);
                });

                // Called when we get data from destination to be given to client.
                var onRead = function(readInfo) {
                  console.log("Got data from destination, sending it to the client.");
                  clientTcpConnection.sendRaw(readInfo.data);
                  //chrome.socket.read(socketId, null, onRead);
                }
                chrome.socket.read(socketId, null, onRead);

                // Get socket info to tell socks client the final port/IP we
                // connected to.
                chrome.socket.getInfo(socketId, function(socketInfo) {
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
