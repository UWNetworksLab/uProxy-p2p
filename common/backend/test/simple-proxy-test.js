console.log('simple-proxy-test.js, running in worker ' + self.location.href);

var window;
if (!window) {
  window = {};
  console.log("tcp-server: making up a fake window.  Good luck with that.");
}



// Client is used to manage a peer connection to a contact that will proxy our
// connection. This module listens on a localhost port and forwards requests
// through the peer connection.
var client = freedom.uproxyclient();

// Server module; listens for peer connections and proxies their requests
// through the peer connection.
var server = freedom.uproxyserver();

var pA = "pA";
var pB = "pB";

console.log("Setting up signalling");
// msg : {peerId : string, // peer id message should go to.
//        data : json-string}

client.on("sendSignalToPeer", function (msg) {
  server.emit("handleSignalFromPeer",
      // Message came from pA.
      {peerId: pA, data: msg.data});
});

// msg : {peerId : string, // peer id message should go to.
//        data : json-string}
server.on("sendSignalToPeer", function (msg) {
  client.emit("handleSignalFromPeer",
      // message came from pB
      {peerId: pB, data: msg.data});
});

function start() {
  server.emit("start");
  client.emit("start",
      {'host': '127.0.0.1', 'port': 8888,
        // peerId of the peer being routed to.
       'peerId': pB});
  console.log("started client and server!");
}

function stop() {
  server.emit("stop");
  client.emit("stop");
  console.log("stopped client and server!");
}

freedom.on("start", start);
freedom.on("stop", stop);
window.socket = freedom['core.socket']();