'use strict';

var socksServer = new window.SocksServer("127.0.0.1", 9999, window.relayOverWebRtc);

console.log("Starting test...");
socksServer.tcpServer.listen();
