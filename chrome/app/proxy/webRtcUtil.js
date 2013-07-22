/**
 * Utilities for web rtc.
 *
 * TODO: This is a very immature implementation **on localhost** for testing that won't handle multiple sockets --
 * we need to create multiple instances of likely WebRtcClient and WebRtcServer classes for this to work for
 * multiple connections in the real world.
 */
'use strict';

(function(exports) {

  var WebRtcUtil = {};
  var pc1, pc2, sendChannel, receiveChannel, destSocketId;

  WebRtcUtil.createConnection = function (onPeerOpen) {
    var servers = null;
    this.pc1 = new webkitRTCPeerConnection(servers,
      {optional: [
        {RtpDataChannels: true}
      ]});
    console.log('Created local peer connection object pc1');

    try {
      // Reliable Data Channels not yet supported in Chrome
      // Data Channel api supported from Chrome M25.
      // You need to start chrome with  --enable-data-channels flag.
      this.sendChannel = this.pc1.createDataChannel("sendDataChannel",
        {reliable: false});
      console.log('Created send data channel');
    } catch (e) {
      console.error('Create Data channel failed with exception: ' + e.message);
    }
    console.log('Setting up callback...');
    this.pc1.onicecandidate = this.iceCallback1.bind(this);
    this.sendChannel.onopen = function () {
      this.onPeerOpen.bind(this);
      this.socksClient = onPeerOpen(this.sendChannel);
    }.bind(this);
    this.sendChannel.onclose = this.onPeerClose.bind(this);
    this.sendChannel.onmessage = function (event) {
      console.log("Received message on send channel!!");
      console.dir(event);
      //var buf = Encoding.b64toab(event.data);
      //onData(buf);
      this.socksClient.sendToSocksClient(event.data);
    }.bind(this);

    console.log('creating connection...');
    this.pc2 = new webkitRTCPeerConnection(servers,
      {optional: [
        {RtpDataChannels: true}
      ]});
    console.log('Created remote peer connection object pc2');

    this.pc2.onicecandidate = this.iceCallback2.bind(this);
    this.pc2.ondatachannel = this.receiveChannelCallback.bind(this);

    this.pc1.createOffer(this.gotDescription1.bind(this));
  };

  WebRtcUtil.closeDataChannels = function () {
    console.log('Closing data Channels');
    this.sendChannel.close();
    console.log('Closed data channel with label: ' + sendChannel.label);
    this.receiveChannel.close();
    console.log('Closed data channel with label: ' + receiveChannel.label);
    this.pc1.close();
    this.pc2.close();
    this.pc1 = null;
    this.pc2 = null;
    console.log('Closed peer connections');
  };

  WebRtcUtil.receiveChannelCallback = function (event) {
    console.log('Receive Channel Callback');
    this.receiveChannel = event.channel;
    this.receiveChannel.onmessage = this.onReceiveMessageCallbackHeader.bind(this);
    this.receiveChannel.onopen = this.onReceiveChannelStateChange.bind(this);
    this.receiveChannel.onclose = this.onReceiveChannelStateChange.bind(this);
  };

  WebRtcUtil.onReceiveMessageCallbackHeader = function(event) {
    var raw = Encoding.b64touint8Array(event.data);
    console.log("Received message: '" + raw + "'");
    var socksConnect = SocksUtil.interpretSocksRequest(raw);
    console.log("Parsed full socks request");
    console.dir(socksConnect);
    chrome.socket.create("tcp", null, function (createInfo) {
      // Socket is now created.
      this.destSocketId = createInfo.socketId;
      chrome.socket.connect(this.destSocketId,
        socksConnect.addressString,
        socksConnect.port, function () {
          console.log("Socket connected to destination site!!");
          // Return a socks message saying we've successfully connected.
          var response = [];
          // creating response
          response[0] = SocksUtil.VERSION5;
          response[1] = SocksUtil.RESPONSE.SUCCEEDED;
          response[2] = 0x00;
          response[3] = SocksUtil.ATYP.IP_V4;
          response[4] = 0x00;
          response[5] = 0x00;
          response[6] = 0x00;
          response[7] = 0x00;
          response[8] = createInfo.port & 0xF0;
          response[9] = createInfo.port & 0x0F;

          var connected = Encoding.abtob64(response);
          console.log("Connected: "+connected);
          console.dir(this.receiveChannel);
          this.receiveChannel.send(connected);

          // Wire up the data handler on the web rtc connection to just relay raw data post-socks.
          this.receiveChannel.onmessage = this.onReceiveMessageCallback.bind(this);

          var socketRead = function(readInfo) {
            console.log("Reading from socket to destination site");
            if (readInfo.resultCode > 0) {
              console.log("Got read info!!!");
              console.dir(readInfo);
              //var str = Encoding.ab2str(readInfo.data);
              //console.log("Read string..."+str);
              var b64 = Encoding.abtob64(readInfo.data);

              var decoded = atob(b64);
              console.log("DECODED: "+decoded);
              console.log("Read data: '%s'", b64);
              console.log("Read data length: ", b64.length);

              var written = 0;
              var chunkSize = 100;

              /*
              var sendChunk = function () {
                var limit = written + chunkSize;
                if (limit > str.length) {
                  limit = str.length;
                }

                console.log("Sending chunk from %d to %d", written, limit);
                var chunk = str.substring(written, limit);
                console.log("Sending chunk: %s", chunk);

                setTimeout(function (){
                  this.receiveChannel.send(chunk);
                  written = limit;
                  sendChunk();

                }.bind(this), 200);
              }.bind(this);
              sendChunk();
              */

              while (written < b64.length) {
                var limit = written + chunkSize;
                if (limit > b64.length) {
                  limit = b64.length;
                }

                console.log("Sending chunk from %d to %d", written, limit);
                var chunk = b64.substring(written, limit);
                console.log("Sending chunk: %s", chunk);
                this.receiveChannel.send(chunk);
                //setTimeout(function (){
//                  this.receiveChannel.send(chunk);
  //              }.bind(this), 200);

                written = limit;
              }



              console.log("Sent data back through web rtc...");
              chrome.socket.read(this.destSocketId, null, socketRead);
            } else {
              // Otherwise it's a disconnect, so we need to disconnect from the web rtc client.
              this.receiveChannel.close();
            }

          }.bind(this);
          chrome.socket.read(this.destSocketId, null, socketRead);
        }.bind(this));
    }.bind(this));
  };

  WebRtcUtil.onReceiveMessageCallback = function(event) {
    console.log('Processing message callback');
    console.dir(event);
    var buf = Encoding.b64toab(event.data);
    chrome.socket.write(this.destSocketId, buf, function(writeInfo) {
      console.log('Received write callback');
      console.dir(writeInfo);
    });
  };

  WebRtcUtil.gotDescription1 = function(desc) {
    console.log('pc1: '+this.pc1);
    this.pc1.setLocalDescription(desc);
    console.log('Offer from pc1 \n' + desc.sdp);
    this.pc2.setRemoteDescription(desc);
    this.pc2.createAnswer(this.gotDescription2.bind(this));
  }

  WebRtcUtil.gotDescription2 = function(desc) {
    this.pc2.setLocalDescription(desc);
    console.log('Answer from pc2 \n' + desc.sdp);
    this.pc1.setRemoteDescription(desc);
  }

  WebRtcUtil.iceCallback1 = function(event) {
    console.log('local ice callback');
    if (event.candidate) {
      this.pc2.addIceCandidate(event.candidate);
      console.log('Local ICE candidate: \n' + event.candidate.candidate);
    }
  }

  WebRtcUtil.iceCallback2 = function(event) {
    console.log('remote ice callback');
    if (event.candidate) {
      this.pc1.addIceCandidate(event.candidate);
      console.log('Remote ICE candidate: \n ' + event.candidate.candidate);
    }
  }

  WebRtcUtil.onPeerOpen = function() {
    var readyState = this.sendChannel.readyState;
    console.log('Send channel state is: ' + readyState);
    if (readyState == "open") {

    } else {
    }
  }

  WebRtcUtil.onPeerClose = function() {
    var readyState = this.sendChannel.readyState;
    console.log('Send channel state is: ' + readyState);
    if (readyState == "open") {

    } else {
    }
  }

  WebRtcUtil.onReceiveChannelStateChange = function() {
    var readyState = this.receiveChannel.readyState;
    console.log('Receive channel state is: ' + readyState);
  }

  exports.WebRtcUtil = WebRtcUtil;
})(window);
