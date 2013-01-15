/**
 * Chrome Socket based Node DNS Implementation.
 *
 * Currently only handles the methods needed by node-xmpp.
 * @author Will Scott (willscott@gmail.com)
 */

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
  SRV: 33,
  AXFR: 252,
  MAILB: 253,
  MAILA: 254,
  ALL: 255
};

var _nid = 1;
function nextId() {
  return _nid++;
}

/**
 * Create a Network Packet from a DNS Query.
 * @param {id: short, query: domain name string, type: DNSTypes} dns
 * @return {ArrayBuffer}
 */
// TODO(willscott): Support multiple queries/message.
function flattenDNS(dns) {
  var length = 18 + dns.query.length;
  var buffer = new ArrayBuffer(length);
  var byteView = new Uint8Array(buffer);
  var dataView = new DataView(buffer);
	dataView.setUint16(0, nextId());
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

/**
 * Parse a textual label (A domain name) from a buffer.
 * @param {DataView} buffer
 * @param {Number} offset
 * @param {Boolean} nofollow OPTIONAL Don't follow label pointers.
 * @return {{text:String, length:Number}} the domain name & length of the inline label.
 */
function parseLabel(buffer, offset, nofollow) {
	var data = buffer.getUint8(offset);
	if (data == 0) {
		return {text: "", length: 1};
	} else if ((data & 192) == 192) { // Pointer.
		if (nofollow) {
			console.warn("Skipping Nested DNS label Pointer.");
			return {text: "", length: 2};
		} else {
			var offset = buffer.getUint16(offset) ^ (192 << 8)
		  return {text: parseLabel(buffer, offset, true).text, length: 2};
		}
	} else { // Length.
		offset++;
		var ret = "";
		for (var i = 0; i < data; i++) {
			ret += String.fromCharCode(buffer.getUint8(offset++))
		}
		var rest = parseLabel(buffer, offset, nofollow);
		if (rest.text.length) {
			return {text: ret + "." + rest.text, length: 1 + data + rest.length};
		} else {
			return {text: ret, length: 1 + data + rest.length};
		}
	}
}

/**
 * Parse an SRV Record
 * @param {ArrayBuffer} data
 * @return {{priority:, weight:, name:, port:}}
 */
function _parseSRV(data) {
	var srv = {};
	var buf = new DataView(data);
	srv.priority = buf.getUint16(0);
	srv.weight = buf.getUint16(2);
	srv.port = buf.getUint16(4);
	srv.name = parseLabel(buf, 6, true).text;
	return srv;
}

/**
 * Create a JS data structure from a DNS response packet.
 * @param {ArrayBuffer} dns
 * @return {Object} packet structure.
 */
function parseDNS(dns) {
	var dataView = new DataView(dns);
	var ret = {};
	ret.id = dataView.getUint16(0);
	if ((dataView.getUint8(2) & 128) != 128) { // is it a response
		console.warn("Asked to parse a DNS response that is not a response");
		return {};
	}
	ret.authoritative = (dataView.getUint8(2) & 4) == 4;
	ret.truncated = (dataView.getUint8(2) & 2) == 2;
	ret.recursed = (dataView.getUint8(2) & 1) == 1;
	ret.canRecurse = (dataView.getUint8(3) & 128) == 128;
	ret.code = dataView.getUint8(3) & 15;
	var nq = dataView.getUint16(4);
	var na = dataView.getUint16(6);
	var ns = dataView.getUint16(8);
	var ar = dataView.getUint16(10);
  var offset = 12;
	for (var i = 0; i < nq; i++) {
		// Parse Query
		var label = parseLabel(dataView, offset);
		offset += label.length;
		var type = dataView.getUint16(offset);
		offset += 2;
		var qclass = dataView.getUint16(offset);
		offset += 2;
		var q = {
			label: label.text,
			type: type,
			qclass: qclass
		};
		if (!ret.query) {
			ret.query = [q];
		} else {
			ret.query.push(q);
		}
	}

	for (var i = 0; i < na; i++) {
		// Parse Answer
		var label = parseLabel(dataView, offset);
		offset += label.length;
		var type = dataView.getUint16(offset);
		offset += 2;
		var rclass = dataView.getUint16(offset);
		offset += 2;
		var ttl = dataView.getUint32(offset);
		offset += 4;
		var rdl = dataView.getUint16(offset);
		offset += 2;
		var response = new Uint8Array(dns, offset, rdl);
		offset += rdl;
		var r = {
			label: label.text,
			type: type,
			rclass: rclass,
			ttl: ttl,
			response: response
		};
		if (!ret.response) {
			ret.response = [r];
		} else {
			ret.response.push(r);
		}
	}
	// TODO(willscott): handle NS, Additional data.
	return ret;
}

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

//TODO(willscott): Add ipv6 support.
function isIP(ip) {
	var x = /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
	return x.test(ip);
}

function getaddrinfo(domain, family) {
		if (family != 4 && family != 0) {
			console.warn("IPV6 Not supported!");
		}
		var ret = new deferred();
		var msg = flattenDNS({query: domain, type: DNSTypes.A});
		queryDNS('8.8.8.8', msg, function(resp) {
			if (!resp || resp.resultCode < 0)
				return ret.oncomplete(null);
			var obj = parseDNS(resp.data);
			var addresses = [];
			for (var i = 0; i < obj.response.length; i++) {
				var answer = obj.response[i];
				if (answer.type == DNSTypes.A) {
					var quad = answer.response;
					var addr = quad[0] + "." + quad[1] + "." + quad[2] + "." + quad[3];
					addresses.push(addr);
				}
			}
			return ret.oncomplete(addresses);
		});
		return ret;
};
	
function querySrv(name, onanswer) {
		var ret = new deferred();
		ret.oncomplete = onanswer;
		var msg = flattenDNS({query: name, type: DNSTypes.SRV});
		queryDNS('8.8.8.8', msg, function(resp) {
			if (!resp || resp.resultCode < 0)
				return ret.oncomplete(-1, null);
			var obj = parseDNS(resp.data);
			var records = [];
			if (obj.response) {
			  for (var i = 0; i < obj.response.length; i++) {
				  var answer = obj.response[i];
				  if (answer.type == DNSTypes.SRV) {
					  records.push(_parseSRV(answer.response.buffer));
				  }
			  }
			}
			onanswer(0, records);
		});
		return ret;
	}
};


var deferred = function() {
	this.oncomplete = function() {};
};

function makeAsync(callback) {
  if (typeof callback !== 'function') {
    return callback;
  }
  return function asyncCallback() {
    if (asyncCallback.immediately) {
      // The API already returned, we can invoke the callback immediately.
      callback.apply(null, arguments);
    } else {
      var args = arguments;
			setTimeout(function() {
        callback.apply(null, args);
      }, 0);
    }
  };
}

function errnoException(errorno, syscall) {
  // TODO make this more compatible with ErrnoException from src/node.cc
  // Once all of Node is using this function the ErrnoException from
  // src/node.cc should be removed.
  var e = new Error(syscall + ' ' + errorno);

  // For backwards compatibility. libuv returns ENOENT on NXDOMAIN.
  if (errorno == 'ENOENT') {
    errorno = 'ENOTFOUND';
  }

  e.errno = e.code = errorno;
  e.syscall = syscall;
  return e;
}

exports.lookup = function(domain, callback) {
	family = 0;
	callback = makeAsync(callback);
	if (!domain) {
	    callback(null, null, family === 6 ? 6 : 4);
	    return {};
	}
	var matchedFamily = chromeSupport.isIP(domain);
	if (matchedFamily) {
	  callback(null, domain, matchedFamily);
	  return {};
	}
	
	function onanswer(addresses) {
	    if (addresses) {
	      if (family) {
	        callback(null, addresses[0], family);
	      } else {
	        callback(null, addresses[0], addresses[0].indexOf(':') >= 0 ? 6 : 4);
	      }
	    } else {
	      callback(errnoException(errno, 'getaddrinfo'));
	    }
	  }
		
		var wrap = chromeSupport.getaddrinfo(domain, family);

		  if (!wrap) {
		    throw errnoException(errno, 'getaddrinfo');
		  }

		  wrap.oncomplete = onanswer;

		  callback.immediately = true;
		  return wrap;
};

exports.resolveSrv = function(name, callback) {
	function onanswer(status, result) {
	  if (!status) {
	   callback(null, result);
	  } else {
	    callback(errnoException(errno, bindingName));
	  }
	}

	callback = makeAsync(callback);
	var wrap = chromeSupport.querySrv(name, onanswer);
	if (!wrap) {
	  throw errnoException(errno, bindingName);
	}

	callback.immediately = true;
	return wrap;
};