/**
 * Relays data over web rtc to a destination web site.
 */
'use strict';

(function(exports) {

  function WebRtcRelayer(socksClientConnection, sendChannel) {
    this.socksClientConnection = socksClientConnection;
    this.sendChannel = sendChannel;

    this.socksClientConnection.tcpConnection.on('recv', function(buffer) {

      //console.log("Received data from socks client: '%s'", Encoding.ab2str(buffer));
      console.dir(buffer);
      this.sendToPeer(buffer);
    }.bind(this));
  }

  WebRtcRelayer.prototype.sendToSocksClient = function(b64) {
    console.log("Sending data to socks client: '%s'", b64);
    var raw = Encoding.b64toab(b64);//Encoding.b64toab('AB');//Encoding.b64toab(b64);
    if (this.socksClientConnection.tcpConnection.isConnected) {
      console.log("Sending raw response to tcp connection: "+raw);
      this.socksClientConnection.tcpConnection.sendRaw(raw, function() {
        console.log('Got callback from send call');
      });
    } else {
      console.log('SOCKS client no longer connected, disconnecting WebRtc client');
      this.sendChannel.close();
    }
  }

  WebRtcRelayer.prototype.sendToPeer = function(buf) {
    var b64 = Encoding.abtob64(buf);
    console.log("Sending data from peer 1 to peer 2 '%s'", b64);
    this.sendChannel.send(b64);
  }

  var relayOverWebRtc = function (socksClientConnection, address, port, connectedToDestinationCallback) {

    var socksRequest = socksClientConnection.result;
    console.log("Received request...");
    console.dir(socksRequest);

    var client = socksClientConnection.tcpConnection;

    var onPeerConnection = function (sendChannel) {
      // This means we've established a connection to the remote *peer*, not necessarily the remote
      // destination. The remote destination will send a SOCKS CONNECTED response when it's successfully
      // connected to the destination.
      console.log('Established PEER connection...');
      var relayer = new WebRtcRelayer(socksClientConnection, sendChannel);
      relayer.sendToPeer(socksRequest.raw);
      return relayer;

      // We now relay the connected response from the remote side.
      /*
       connectedToDestinationCallback (connectionDetails, function() {
       console.log("Callback from callback!!");
       });
       */
      //var response = SocksUtil.connected(address, port);


      //
      /*
       client.on('recv', function(buffer) {
       //try {
       console.log('SocksDestConnection(%d): %d bytes.',
       client.socketId, buffer.byteLength);
       var data = abtob64(buffer);
       console.log("Sending data: "+data);
       sendChannel.send(data);
       });
       */
    };

    var processConnect = function() {
      // Create a web rtc connection.

      WebRtcUtil.createConnection(onPeerConnection);
    };


    var processOtherSocks = function() {

    };

    if (socksRequest.cmd == SocksUtil.REQUEST_CMD.CONNECT) {
      processConnect();
    } else {
      processOtherSocks();
    }
  }
  exports.relayOverWebRtc = relayOverWebRtc;
})(window);