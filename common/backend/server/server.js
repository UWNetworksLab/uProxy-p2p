//XXX: needed for chrome debugging, used by socks.js and tcp-server.js.
"use strict";

var window;
if (!window) {
  window = {};
}
console.log('SOCKS5 server: ' + self.location.href);

window.socket = freedom['core.socket']();
// Defined in webclient.js
var NetClient = window.NetClient;

var onload = function() {
  var _active = true;  // this variable can only make things worse.
  var _peers = {};

  var resetServer = function() {
    for (var contact in _peers) {
      closePeer(contact);
    }
    _peers = {};
    _active = false;
  };

  // Close the peerId. Closes all tcp sockets open for this peer.
  var closePeer = function(peerId) {
    //conn.disconnect();
    for (var i in _peers[peerId].netClients[peerId]) {
      _peers[peerId].netClients[i].close();
    }
    _peers[peerId].sctpPc.shutdown();
    delete _peers[peerId];
  };

  var _sendDataToPeer = function (sctpPc, channelLabel, data) {
    sctpPc.send({'channelLabel': channelLabel, 'buffer': data});
  };

  //
  var _initPeer = function(peerId) {
    console.log("server.js: _initPeer(" + peerId + ").  _peers = " +
        JSON.stringify(_peers));
    if (!_peers[peerId]) {
      _peers[peerId] = {};
    }

    var sctpPc = freedom['core.sctp-peerconnection']();
    var netClients = {};
    var peer = {
      // The peer connection.
      sctpPc : sctpPc,
      // We open up multple connections, for each data channels there is a
      // corresponding webclient. Each entry is keyed by channelLabel with
      // value being a NetClient.
      netClients : netClients,
      // The freedom signalling channel
      signallingChannel : null,
      // queue of messages to hold on to while we wait for the
      // signallingChannel to be ready.
      messageQueue : []
    };
    _peers[peerId] = peer;

    sctpPc.on('onReceived', function(message) {
      console.log("Server got message: " + JSON.stringify(message));
      if (! message.channelLabel) {
        console.error("Message received but missing channelLabel. Msg: " +
            JSON.stringify(message));
        return;
      }

      if (message.text) {
        // Text from the peer is used to set a new destination request.
        // Assumes "message.text" is a json of form:
        // { host: string, port: number }
        netClients[message.channelLabel] = new window.NetClient(
            _sendDataToPeer.bind(null, sctpPc, message.channelLabel),
            JSON.parse(message.text));
      } else if (message.buffer) {
        if(!message.channelLabel in netClients) {
          console.error("Message received for non-existent channel. Msg: " +
            JSON.stringify(message));
        }

        // Buffer from the peer is data for the destination.
        netClients[message.channelLabel].send(message.buffer);
      } else {
        console.error("Message received but missing valid data field. Msg: " +
            JSON.stringify(message));
      }
    });

    var promise = freedom.core().createChannel();
    promise.done(function(chan) {
      sctpPc.setup(chan.identifier, "server-for-" + peerId, false);
      chan.channel.done(function(channel) {
        // When
        console.log("Server channel to sctpPc created");
        channel.on('message', function(msg) {
          freedom.emit('sendSignalToPeer', { peerId: peerId, data: msg });
        });
        // sctpPc will emit 'ready' when it is ready, and at that point we
        // have successfully initialised this peer connection and can set the
        // signalling channel and process any messages we have been sent.
        channel.on('ready', function() {
          console.log("Server channel to sctpPc ready.");
          peer.signallingChannel = channel;
          while(peer.messageQueue.length > 0) {
            peer.signallingChannel.emit('message', peer.messageQueue.shift());
          }
        });
      });
    });
    console.log('_initPeer(' + peerId + ') complete.');
  };

  freedom.on('start', function() {
    console.log("Starting server.");
    resetServer();
    _active = true;
  });

  // msg.peerId : string of the clientId for the peer being sent a message.
  // msg.data : message body received peerId signalling channel, typically
  //            contains SDP headers.
  //
  freedom.on('handleSignalFromPeer', function(msg) {
    console.log("server handleSignalFromPeer:" + JSON.stringify(msg));
    if (!_active) {
      console.log("server is not active, returning");
      return;
    }
    if (!msg.peerId) {
      console.error('No peer ID provided!.')
      return;
    }
    // TODO: Check for access control?
    console.log("sending to transport: " + JSON.stringify(msg.data));
    // Make a peer for this id if it doesn't already exist.
    if (!_peers[msg.peerId]) {
      _initPeer(msg.peerId);
    }
    if (_peers[msg.peerId].signallingChannel){
      // Send response to peer.
      console.log('SENDING!!!!! ' + JSON.stringify(msg.data));
      _peers[msg.peerId].signallingChannel.emit('message', msg.data);
    } else {
      console.log('signallingChannel not yet ready. Adding to queue... ' + msg.peerId + ' ... ' + _peers);
      _peers[msg.peerId].messageQueue.push(msg.data);
    }
  });

  freedom.on('stop', resetServer);

  freedom.emit('ready', {});
}

//TODO(willscott): WebWorker startup errors are hard to debug.
// Once fixed, code can be executed synchronously.
setTimeout(onload, 0);
