
function _localTestProxying() {
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
  server.emit("start");
  client.emit("start",
      {'host': '127.0.0.1', 'port': 9999,
        // peerId of the peer being routed to.
       'peerId': pB});
  console.log("ready...");
};
