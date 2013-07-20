// socks_test.js

socksServer = new window.LocalSocksServer("127.0.0.1", 9999,
  function (clientTcpConnection, address, port,
        connectedToDestinationCallback) {
      // Implement your own proxy here! Do encryption, tunnelling, whatever! Go flippin' mental!
      // I plan to tunnel everything including SSH over an HTTP tunnel. For now, though, here is the plain proxy:

      console.log('faking being connected to destination...')

      connectedToDestinationCallback();

      clientTcpConnection.send("HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\nhello?");

      clientTcpConnection.on('recv', function(d) {
        // If the application tries to send data before the proxy is ready, then that is it's own problem.
        try {
          console.log('received data from client to send to destination: ' + d.length + ' bytes.');
          // TODO: send to destination, e.g. via webrtc, direct tcp
          // socket.
          clientTcpConnection.send("HTTP/1.0 200 OK\r\nContent-Type: text/html\r\n\r\nhello?");
          clientTcpConnection.disconnect();
        } catch(err) {
          // TODO: send error back to socks somehow
        }
      });

      clientTcpConnection.on('disconnect', function(clientTcpConnection) {
        console.error('The client closed');
      });

});

console.log("starting server...");
socksServer.tcpServer.listen();
