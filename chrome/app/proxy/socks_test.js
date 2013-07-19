// socks_test.js

new window.LocalSocksServer(function (clientTcpConnection, address, port,
        connectedToDestinationCallback) {
      // Implement your own proxy here! Do encryption, tunnelling, whatever! Go flippin' mental!
      // I plan to tunnel everything including SSH over an HTTP tunnel. For now, though, here is the plain proxy:

      console.log('faking being connected to destination...')

      connectedToDestinationCallback();

      tcpConnection.on('recv', function(d) {
        // If the application tries to send data before the proxy is ready, then that is it's own problem.
        try {
          console.log('received data from client to send to destination: ' + d.length + ' bytes.');
          // TODO: send to destination, e.g. via webrtc, direct tcp
          // socket.
          tcpConnection.writeRaw(d);
        } catch(err) {
          // TODO: send error back to socks somehow
        }
      });

      tcpConnection.on('disconnect', function(tcpConnection) {
        console.error('The client closed');
      });

});
