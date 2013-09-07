// socks_test.js
'use strict';

// Returns true if the supplied string looks like it comprises the start of
// a HTTP request. According to section 5.1 of RFC 2616, the first line of a
// HTTP request looks a little like this:
//   Method SP Request-URI SP HTTP-Version CRLF
// (where SP is a space character)
//
// http://regexpal.com/ is a great place to test the regex.
//var isHttpRequestRegex = new RegExp('\\w+?\\s\\S+?\\sHTTP/1.1.*');
var isHttpRequestRegex = new RegExp('^\\w+?\\s\\S+?\\sHTTP/1.1\r\n');
var isHttpRequest = function(s) {
  return isHttpRequestRegex.test(s);
};

// Takes a packet, as an ArrayBuffer, and returns an ArrayBuffer with an
// X-Forwarded-For header added. The returned ArrayBuffer may be the
// supplied ArrayBuffer if the header doesn't need to or cannot be added.
// The header, if added, will appear as the final header.
//
// Several caveats:
//  - assumes there isn't already an X-Forwarded-Header present
//  - assumes each HTTP request starts at the beginning of the packet
//  - assumes each packet contains the entire request
//  - has no notion of state so, for example, this will insert the header
//    mid-request if the client is trying to upload a file containing a
//    HTTP request
//  - untested against multiple character encodings
//
// However, in practice, this works reasonably well, at least with Firefox
// and Chrome clients. Lots of work to be done, though.
var maybeAddXffHeader = function(buffer, clientTcpConnection) {
  // In practice, the maximum length for URLs is about 2000 characters so if we
  // take the first 2500 characters of the packet we're almost sure to include
  // the entire first line.
  var bytes = new Uint8Array(buffer);
  var packetOpening = buffer.slice(0, Math.min(2500, buffer.byteLength));
  if (!isHttpRequest(getStringOfArrayBuffer(packetOpening))) {
    return buffer;
  }

  // The header which has the form:
  //   X-Forwarded-For: client, proxy1
  var xffHeader = '\r\nX-Forwarded-For: ' +
      clientTcpConnection.state().socketInfo.peerAddress;

  // Search for the end of the request headers. This is where we'll insert our
  // custom headers. For now, we just look for a CRLFCRLF sequence which
  // the final header.
  var insertionPoint = -1;
  for (var i = 0; i <= bytes.length - 4; i++) {
    if (bytes[i] == 13 && bytes[i + 1] == 10 &&
        bytes[i + 2] == 13 && bytes[i + 3] == 10) {
      insertionPoint = i;
    }
  }

  // If we couldn't find the end of the request, do nothing.
  if (insertionPoint == -1) {
    console.error('This looks like a HTTP request but I could not figure ' +
        + 'out where to insert the XFF header.');
    return buffer;
  }

  // Re-build the client request, with our custom header(s).
  // Sadly, slice() isn't much use to us here so this is pretty ugly.
  var rewrittenBuffer = new ArrayBuffer(buffer.byteLength + xffHeader.length);
  var rewrittenBufferBytes = new Uint8Array(rewrittenBuffer);
  for (var i = 0; i < insertionPoint; i++) {
    rewrittenBufferBytes[i] = bytes[i];
  }
  for (var i = 0; i < xffHeader.length; i++) {
    rewrittenBufferBytes[insertionPoint + i] = xffHeader.charCodeAt(i);
  }
  // Probably overkill but just in case there's something after the CRLFCRLF.
  for (var i = insertionPoint; i < bytes.length; i++) {
    rewrittenBufferBytes[i + xffHeader.length] = bytes[i];
  }
  return rewrittenBuffer;
};

var socksServer = new window.SocksServer("127.0.0.1", 9999,
    function (socksClientConnection, address, port,
              connectedToDestinationCallback) {

      var clientTcpConnection = socksClientConnection.tcpConnection;
      var clientSocketId = clientTcpConnection.socketId;

      if(socksClientConnection.result.cmd == SocksUtil.REQUEST_CMD.CONNECT) {
        chrome.socket.create("tcp", null, function (createInfo) {
          // Socket is now created.
          var destConnected = false;
          var destSocketId = createInfo.socketId;

          var disconnect = function () {
            if (!destConnected) return;
            chrome.socket.disconnect(destSocketId);
            chrome.socket.destroy(destSocketId);
            destConnected = false;
            if(clientTcpConnection.isConnected)
              clientTcpConnection.disconnect();
          };

          chrome.socket.connect(destSocketId,
              socksClientConnection.result.addressString,
              socksClientConnection.result.port, function() {
                destConnected = true;
                // Socket is now connected.

                // When we get data from client, send it to dest.
                clientTcpConnection.on('recv', function(buffer) {

                  console.log('%s: got data: %s', JSON.stringify(clientTcpConnection.state()),
                    getStringOfArrayBuffer(buffer));

                  //try {
                    if(!destConnected) {
                      clientTcpConnection.disconnect();
                      return;
                    }
                    console.log('SocksDestConnection(%d -> %d): %d bytes.',
                      clientSocketId, destSocketId,
                      buffer.byteLength);
                    // TODO: send to destination, e.g. via webrtc, direct tcp
                    // socket.

                    // Examine the packet, possibly inserting headers such as
                    // X-Forwarded-For.
                    var bufferToForward = maybeAddXffHeader(buffer,
                        clientTcpConnection);

                    // Forward the (possibly modified) client data to the destination.
                    chrome.socket.write(destSocketId, bufferToForward, function () {
                      console.log('SocksDestConnection(%d): %d bytes.', clientSocketId, buffer.byteLength);
                    });
                  //} catch(err) {
                    // TODO: send error back to socks somehow?
                  //  console.error("error trying to send data to destination: ", err);
                  //}
                });

                clientTcpConnection.on('disconnect', function(connection) {
                  console.log('SocksDestConnection(%d -> %d): client closed',
                      clientSocketId, destSocketId);
                  disconnect();
                });

                // Called when we get data from destination to be given
                // to client.
                var onRead = function(readInfo) {
                  if (readInfo.resultCode < 0) {
                    console.warn('SocksDestConnection(%d -> %d): resultCode: %d. Disconnecting', clientSocketId, destSocketId, readInfo.resultCode);
                    disconnect();
                    return;
                  } else if (readInfo.resultCode == 0) {
                    disconnect();
                    return;
                  }

                  if(clientTcpConnection.isConnected) {
                    console.log("SocksDestConnection(%d -> %d): Got data from destination, sending it to the client (%d bytes).", clientSocketId, destSocketId, readInfo.resultCode);
                    clientTcpConnection.sendRaw(readInfo.data);
                  }
                  if(destConnected) {
                    // chrome.socket.read(socketId, null, onRead);
                    chrome.socket.read(destSocketId, null, onRead);
                  }
                }
                chrome.socket.read(destSocketId, null, onRead);

                // Get socket info to tell socks client the final port/IP we
                // connected to.
                chrome.socket.getInfo(destSocketId, function(socketInfo) {
                  // We now have socket Info. Now we tell client that connection
                  // success details.
                  var connectionDetails = {
                    ipAddrString: socketInfo.peerAddress,
                    port: socketInfo.peerPort
                  }
                  connectedToDestinationCallback(connectionDetails);
                }); // socket.getInfo
          }); // socket.connect
        }); // socket.create
      }  // if SocksUtil.REQUEST_CMD.CONNECT
}); //

console.log("Starting test...");
socksServer.tcpServer.listen();
