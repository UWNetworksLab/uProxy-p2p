//XXX: needed for chrome debugging, used by socks.js and tcp-server.js.
var window = {};
console.log('SOCKS5 client');

window.socket = freedom['core.socket']();

console.warn = console.log;
console.error = console.log;

var onload = function() {
  var proxy = null;
  var transport = null;
  var signallingChannel = null;
  var conns = {};

  var shutdown = function() {
    if (proxy) {
      proxy.tcpServer.disconnect();
      proxy = null;
    }
    for (var conn in conns) {
      conns[conn].disconnect();
    }
    conns = {};
    transport = null;
    signallingChannel = null;
  };

  var onClose = function(cid, conn) {
    conn.disconnect();
    delete conns[cid];
  };

  var onConnection = function(conn, address, port, callback) {
    if (transport) {
      // TODO: reuse tags from a pool.
      var tag = Math.random();
      var sock = conn.tcpConnection;
      sock.on('recv', transport.send.bind(transport, tag));
      sock.on('disconnect', onClose.bind({}, tag));
      conns[tag] = sock;

      transport.send(tag, JSON.stringify({host: address, port: port}));
      // TODO: determine if these need to be accurate.
      callback({ipAddrString: '127.0.0.1', port: 0});
    }
  };

  freedom.on('start', function(options) {
    shutdown();
    proxy = new window.SocksServer(options.host, options.port, onConnection);
    proxy.tcpServer.listen();

    var promise = freedom.core().createChannel();
    promise.done(function(chan) {
      transport = freedom.transport();

      transport.on('onClose', shutdown);
      transport.on('message', function(msg) {
        if (msg.tag) {
          conns[msg.tag].sendRaw(msg.data);
        }
        // Use a control method to reuse / close tags.
      });
      transport.open(chan.identifier);
      chan.channel.done(function(channel) {
        channel.on('message', function(msg) {
          freedom.emit('fromClient', {
            data: msg
          });
        });
        channel.on('ready', function() {});
        signallingChannel = channel;
      });
    });
  });

  freedom.on('toClient', function(msg) {
    if (signallingChannel) {
      signallingChannel.emit('message', msg.data);
    } else {
      console.log("Couldn't route incoming signaling message");
    }
  });
  
  freedom.on('stop', shutdown);

  freedom.emit('ready', {});
};

//TODO(willscott): WebWorker startup errors are hard to debug.
// Once fixed, code can be executed synchronously.
setTimeout(onload, 0);
