
function _arrayBufferToString(buf, callback) {
    var bb = new Blob([new Uint8Array(buf)]);
    var f = new FileReader();
    f.onload = function(e) {
      callback(e.target.result);
    };
    f.readAsText(bb);
  }

var server = new window.TcpServer("127.0.0.1", 9999);

server.on("listening", function() {
  console.info('LISTENING %s:%s', server.addr, server.port);
});

server.on("connection", function(tcpConnection) {
  console.info('CONNECTED %s:%s', tcpConnection.socketInfo.peerAddress,
      tcpConnection.socketInfo.peerPort);
});

server.on("recv", function(data) {
  _arrayBufferToString(data, function(s) {
      console.info('RECIEVED %s', s);
  });
});

server.on("disconnect", function(tcpConnection) {
  console.info('DISCONNECTED %s:%s', tcpConnection.socketInfo.peerAddress,
      tcpConnection.socketInfo.peerPort);
});

server.listen();
