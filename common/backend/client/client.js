/*
 * client.js
 *
 * Manages the relationship between a socket-based socks5 proxy which passes
 * the requests over WebRTC datachannels to a give identity.
 */

//XXX: needed for chrome debugging, used by socks.js and tcp-server.js.
var window = {};
console.log('SOCKS5 client: ' + self.location.href);

window.socket = freedom['core.socket']();

var onload = function() {
  var proxy = null;
  var transport = null;
  var signallingChannel = null;
  var conns = {};

  // Stop running as a proxy. Close all connections both to data channels and
  // tcp.
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

  // Close a particular tcp-connection and data channel pair.
  var onClose = function(cid, conn) {
    conn.disconnect();
    delete conns[cid];
  };

  // A SOCKS5 connection request has been received, setup the data channel and
  // start proxying the corresponding tcp-connection to the data channel.
  var onConnection = function(conn, address, port, connectedCallback) {
    if (!transport) {
      console.error("onConnection called without a transport.");
      return;
    }

    // TODO: reuse tags from a pool.
    var channelid = "c" + Math.random();

    // Connect the TCP-connection to the transport.
    conn.tcpConnection.on('recv', transport.send.bind(transport, channelid));
    conn.tcpConnection.on('disconnect', onClose.bind({}, channelid));
    conns[channelid] = conn.tcpConnection;

    transport.send(channelid, JSON.stringify({host: address, port: port}));
    // TODO: determine if these need to be accurate.
    connectedCallback({ipAddrString: '127.0.0.1', port: 0});
  };

  freedom.on('start', function(options) {
    console.log('Cleint: on(start)...');
    shutdown();
    proxy = new window.SocksServer(options.host, options.port, onConnection);
    proxy.tcpServer.listen();

    // Create a freedom-channel to act as the signallin channel.
    var promise = freedom.core().createChannel();
    promise.done(function(chan) {  // When the signalling channel is created.
      // Create a new instance of transport.
      transport = freedom.transport();

      // When WebRTC data-channel transport is closed, shut everything down.
      transport.on('onClose', shutdown);

      // When a data-channel sends us a message, pass it on the corresponding
      // tcp conection.
      transport.on('message', function(msg) {
        if (msg.channelid) {
          conns[msg.channelid].sendRaw(msg.data);
        } else {
          console.error("Message received but missing channelid. Msg: "
              + JSON.stringify(msg));
        }
        // Use a control method to reuse / close tags.
      });

      // chan.identifier is a freedom-proxy (not a socks proxy) for the
      // signalling channel used for signalling.
      transport.open(chan.identifier, true);

      // when the channel is complete, setup handlers.
      chan.channel.done(function(channel) {
        // when the signalling channel gets a message, send that message to the
        // freedom 'fromClient' handlers.
        channel.on('message', function(msg) {
          freedom.emit('fromClient', { data: msg });
        });
        // When the signalling channel is ready, set the global variable.
        channel.on('ready', function() {});
        signallingChannel = channel;
      });
    });
  });

  // Send any toClient freedom messages to the signalling channel.
  freedom.on('toClient', function(msg) {
    if (signallingChannel) {
      signallingChannel.emit('message', msg.data);
    } else {
      console.log("Couldn't route incoming signaling message");
    }
  });

  // If we get the 'stop' message, shutdown.
  freedom.on('stop', shutdown);

  // Setup completed, now emit the ready message.
  freedom.emit('ready', {});
};

//TODO(willscott): WebWorker startup errors are hard to debug.
// Once fixed, code can be executed synchronously.
setTimeout(onload, 0);

