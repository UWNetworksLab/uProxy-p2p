var DNSTypes = {
 A: 1,
 NS: 2,
 MD: 3,
 MF: 4,
 CNAME: 5,
 SOA: 6,
 MB: 7,
 MG: 8,
 MR: 9,
 NULL: 10,
 WKS: 11,
 PTR: 12,
 HINFO: 13,
 MINFO: 14,
 MX: 15,
 TXT: 16,
 AXFR: 252,
 MAILB: 253,
 MAILA: 254,
 ALL: 255
};

/**
 * Create a Network Packet from a DNS Query.
 * @param {id: short, query: domain name string, type: DNSTypes} dns
 * @return {ArrayBuffer}
 */
function flattenDNS(dns) {
  var length = 18 + dns.query.length;
  var buffer = new ArrayBuffer(length);
  var byteView = new Uint8Array(buffer);
  var dataView = new DataView(buffer);
	dataView.setUint16(0, dns.id);
  byteView[2] = 1; // Recursion desired, other flags off.
  byteView[3] = 0; // Response Bits.
	dataView.setUint16(4, 1); // QDCount - # queries
	dataView.setUint16(6, 0); // ANCount - # answers
	dataView.setUint16(8, 0); // NSCount - # NS records
	dataView.setUint16(10, 0); // ARCount - # Additional resources.

  // QNAME
  var labels = dns.query.split(".");
  var offset = 12;
  for(var i = 0; i < labels.length; i++) {
    byteView[offset++] = labels[i].length;
    for (var j = 0; j < labels[i].length; j++) {
      byteView[offset++] = labels[i][j].charCodeAt(0);
    }
  }
  byteView[offset++] = 0; // Root Label

  // QTYPE
  byteView[offset++] = 0;
  byteView[offset++] = dns.type;
  
  // QCLASS - 1 = Internet 
  byteView[offset++] = 0;
  byteView[offset++] = 1;
  
  return buffer;
};

function queryDNS(server, msg, callback) {
  chrome.socket.create('udp', {}, function(_socketInfo) {
    chrome.socket.connect(_socketInfo.socketId, server, 53, function(result) {
			if (result != 0) {
				console.log("Could not connect to server!");
				callback(null);
				chrome.socket.destroy(_socketInfo.socketId);
			}
			var poll = function(n) {
				chrome.socket.read(n, function(r) {
					if (r.resultCode > 0) {
						callback(r);
						chrome.socket.disconnect(n);
						chrome.socket.destroy(n);
					} else {
						poll(n);
					}
				});
			};
			poll(_socketInfo.socketId);
			chrome.socket.write(_socketInfo.socketId, msg, function(sr) {
				if (sr.bytesWritten != msg.byteLength) {
					console.log("Write was unsucessful.");
					callback(null);
					chrome.socket.disconnect(_socketInfo.socketId);
					chrome.socket.destroy(_socketInfo.socketId);
				}
			});
    });
  });
};