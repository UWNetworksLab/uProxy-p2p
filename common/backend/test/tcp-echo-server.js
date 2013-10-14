function TcpEchoServer(address, port) {
  console.log("TcpEchoServer(" + address + ", " + port + ")");
  this.server = new window.TcpServer(address, port);
  this.address = address;
  this.port = port;
  this.server.on('listening', function(address, port) {
    console.log('Listening on ' + address + ':' + port + ', this=' + JSON.stringify(this));
  }.bind(this, address, port));
  this.server.on('connection', function(tcp_conn) {
    console.log('Connected on sock ' + tcp_conn.socketId + ' to ' +
        tcp_conn.socketInfo.peerAddress + ':' + tcp_conn.socketInfo.peerPort);
    tcp_conn.on('recv', function(buffer) {
      // our echo server.
      tcp_conn.sendRaw(buffer, null);
    });
  }, {minByteLength: 1});
  this.server.listen();
}
