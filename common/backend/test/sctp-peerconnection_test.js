"use strict";

var window = {};
console.log('LOCATION: sctp-peerconnection_test: ' + self.location.href);

var peerA;
var peerB;

var onload = function() {

  // Send signal now if ready, or queue.
  function sendSignalToPeer(peer, msg) {
    if (peer.channel) {
      peer.channel.emit('message', msg);
    } else {
      peer.msgQueue.push(msg);
    }
  }

  // sendFn : function (msg) {...}
  // Assigns peer.channel to a channel to send signal messages to the other
  // peer.
  function setupPeer(peer, sendSignalFn) {
    peer.sctpPc.on('onReceived', function(message) {
      console.log(peer.name + ": onReceived: " +
          JSON.stringify(message));
    });
    freedom.core().createChannel().done(function(chan) {
      peer.sctpPc.setup(chan.identifier, peer.peerName, false);
      chan.channel.done(function(channel) {
        peer.channel = channel;
        peer.channel.on('message', sendSignalFn);
        console.log(peer.name + ": signalling channel setup. Queued messages being sent: " + peer.msgQueue.length);
        while(peer.msgQueue.length > 0) {
          peer.channel.emit('message', peer.msgQueue.shift());
        }
      });
    });
  };

  peerA =
    { name : "peerA",
      sctpPc: freedom['core.sctp-peerconnection'](),
      channel: null,
      msgQueue: []
    };

  peerB =
    { name : "peerB",
      sctpPc: freedom['core.sctp-peerconnection'](),
      channel: null,
      msgQueue: []
    };

  /* BUG: uncommenting these lines puts freedom in an infinite loop?
  setupPeer(peerA, sendSignalToPeer.bind(null, peerB));
  setupPeer(peerB, sendSignalToPeer.bind(null, peerA));
  */

  // peerA.peer.send({'channelLabel': "a", 'text': "hello?"});

  console.log("loaded sctp-peerconnection_test");
  console.log('LOCATION: sctp-peerconnection_test: ' + self.location.href);
  freedom.emit('ready');
}

// TODO: WebWorker startup errors are hard to debug.
// Once fixed, code can be executed synchronously.
setTimeout(onload, 2000);
