//XXX: needed for chrome debugging, used by socks.js and tcp-server.js.
var window = {};
console.log('SOCKS5 server: ' + self.location.href);

window.socket = freedom['core.socket']();

var onload = function() {
  var _active = false;
  var _peers = {};

  //
  var resetServer = function() {
    for (var contact in _peers) {
      _peers[contact].close();
    }
    _peers = {};
    _active = false;
    if (_sctpPc) { _sctpPc.shutdown(); }
    _sctpPc = null;
  };

  // Close the peerId. Closes all tcp sockets open for this peer.
  var onClose = function(peerId) {
    //conn.disconnect();
    for (var i in _peers[peerId].webClients[peerId]) {
      _peers[peerId].webClients[i].close();
    }
    _peers[peerId].sctpPc.close();
    delete _peers[peerId];
  };

  //
  var initPeer = function(peerId, peerOptions) {
    if (!_peers[peerId]) {
      _peers[peerId] = {};
    }

    var sctpPc = freedom['core.sctp-peerconnection']();
    var webClients = {};
    var peer = {
      // The peer connection.
      sctpPc : sctpPc,
      // We open up multple connections, for each data channels there is a
      // corresponding webclient. Each entry is keyed by channelId with value:
      // being a WebClient.
      //  { dataChannel: SmartDataChannel,
      //    webclient: WebClient }
      webClients : webClients,
      // The freedom signalling channel
      signallingChannel : null,
      // queue of messages to hold on to while we wait for the
      // signallingChannel to be ready.
      messageQueue : []
    };
    _peers[peerId] = peer;

    sctpPc.on('onMessage', function(message) {
      if (! message.channelId) {
        console.error("Message received but missing channelId. Msg: " +
            JSON.stringify(message));
        return;
      }
      if (! (message.channelId in webClients)) {
        webClients[message.channelId] = new window.webclient(
            sctpPc.send.bind(sctpPc, message.channelId));
      }
      webClients[message.channelId].onMessage(message.data);
    });

    var promise = freedom.core().createChannel();
    promise.done(function(chan) {
      sctpPc.setup(chan.identifier, peerOptions, false);
      chan.channel.done(function(channel) {
        // When
        channel.on('message', function(msg) {
          freedom.emit('fromServer', { to: peerId, data: msg });
        });
        // sctpPc will emit 'ready' when it is ready, and at that point we
        // have successfully initialised this peer connection and can set the
        // signalling channel and process any messages we have been sent.
        channel.on('ready', function() {
          while(peer.messageQueue.length > 0) {
            channel.emit('message', peer.messageQueue.shift());
          }
          peer.signallingChannel = channel;
        });
      });
    });
  };

  freedom.on('start', function(options) {
    resetServer();
    _active = true;
  });

  // msg.peerId : string of the clientId for the peer being sent a message.
  // msg.data : message body received peerId signalling channel, typically
  //            contains SDP headers.
  //
  // TODO: make sure callers set the peerId.
  freedom.on('toServer', function(msg) {
    if (!_active) return;

    // TODO: Check for access control?
    console.log("sending to transport: " + JSON.stringify(msg.data));
    // Make a peer for this id if it doesn't already exist.
    if (!_peers[msg.peerId]) {
      initPeer(msg.peerId);
    }
    if (_peers[msg.peerId].signallingChannel){
      _peers[msg.peerId].signallingChannel.emit('message', msg.data);
    } else {
      _peers[msg.peerId].messageQueue.push(msg.data);
    }
  });

  freedom.on('stop', resetServer);

  freedom.emit('ready', {});
}

//TODO(willscott): WebWorker startup errors are hard to debug.
// Once fixed, code can be executed synchronously.
setTimeout(onload, 0);
