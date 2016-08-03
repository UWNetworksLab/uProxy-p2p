/*jshint node:true, strict:false, bitwise:false*/
/* global freedom */
/**
 * Node DNS partial implementation bound to freedom['core.udpsocket'] calls.
 *
 * Currently only handles the methods needed by node-xmpp. Used by `net.js`.
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
}

/**
 * Parse a textual label (A domain name) from a buffer.
 * @param {DataView} buffer
 * @param {Number} offset
 * @param {Boolean} nofollow OPTIONAL Don't follow label pointers.
 * @return {{text:String, length:Number}} the domain name & length of the inline label.
 */
function parseLabel(buffer, offset, nofollow) {
  var data = buffer.getUint8(offset);
  if (data === 0) {
    return {text: "", length: 1};
  } else if ((data & 192) === 192) { // Pointer.
    if (nofollow) {
      console.warn("Skipping Nested DNS label Pointer.");
      return {text: "", length: 2};
    } else {
      offset = buffer.getUint16(offset) ^ (192 << 8);
      return {text: parseLabel(buffer, offset, true).text, length: 2};
    }
  } else { // Length.
    offset++;
    var ret = "";
    for (var i = 0; i < data; i++) {
      ret += String.fromCharCode(buffer.getUint8(offset++));
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
  if ((dataView.getUint8(2) & 128) !== 128) { // is it a response
    console.warn("Asked to parse a DNS response that is not a response");
    return {};
  }
  ret.authoritative = (dataView.getUint8(2) & 4) === 4;
  ret.truncated = (dataView.getUint8(2) & 2) === 2;
  ret.recursed = (dataView.getUint8(2) & 1) === 1;
  ret.canRecurse = (dataView.getUint8(3) & 128) === 128;
  ret.code = dataView.getUint8(3) & 15;
  var nq = dataView.getUint16(4);
  var na = dataView.getUint16(6);
  var ns = dataView.getUint16(8);
  var ar = dataView.getUint16(10);
  var label, type, qclass, q, i, offset = 12;
  for (i = 0; i < nq; i++) {
    // Parse Query
    label = parseLabel(dataView, offset);
    offset += label.length;
    type = dataView.getUint16(offset);
    offset += 2;
    qclass = dataView.getUint16(offset);
    offset += 2;
    q = {
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

  var rdl, rclass, r, ttl, response;
  for (i = 0; i < na; i++) {
    // Parse Answer
    label = parseLabel(dataView, offset);
    offset += label.length;
    type = dataView.getUint16(offset);
    offset += 2;
    rclass = dataView.getUint16(offset);
    offset += 2;
    ttl = dataView.getUint32(offset);
    offset += 4;
    rdl = dataView.getUint16(offset);
    offset += 2;
    response = new Uint8Array(dns, offset, rdl);
    offset += rdl;
    r = {
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
  var socket = freedom['core.udpsocket']();
  socket.bind('0.0.0.0', 0).then(function() {
    socket.once('onData', function(readInfo) {
      callback(readInfo);
      socket.destroy();
    });
    socket.sendTo(msg, server, 53).then(function(n) {
      if (n !== msg.byteLength) {
        console.log("Write was unsucessful.");
        callback(null);
        socket.destroy().then(socket.off.bind(socket));
      }
    });
  });
}

// Regexp to idenitfy IPv4 addresses.
var ipV4RegExp = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;


//TODO(willscott): Add ipv6 support.
function isIP(ip) {
  if (ipV4RegExp.test(ip)) {
    return 4;
  } else {
    return 0;
  }
}

var deferred = function() {
  this.oncomplete = function() {};
};

function querySrv(name, onanswer) {
  var ret = new deferred();
  ret.oncomplete = onanswer;
  var msg = flattenDNS({query: name, type: DNSTypes.SRV});
  queryDNS('8.8.8.8', msg, function(resp) {
    if (!resp || resp.resultCode < 0) {
      return ret.oncomplete(-1, null);
    }
    var obj = parseDNS(resp.data);
    var records = [];
    if (obj.response) {
      for (var i = 0; i < obj.response.length; i++) {
        var answer = obj.response[i];
        if (answer.type === DNSTypes.SRV) {
          records.push(_parseSRV(answer.response.buffer));
        }
      }
    }
    onanswer(records.length > 0 ? 0 : 'ENOTFOUND', records);
  });
  return ret;
}

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
  if (errorno === 'ENOENT') {
    errorno = 'ENOTFOUND';
  }

  e.errno = e.code = errorno;
  e.syscall = syscall;
  return e;
}

// Dummy out DNS lookup to just return the hostname.  Hostname is compatible
// with TCP Socket APIs, but IP addresses do not work properly with TLS
// due to certificate errors.
exports.lookup = function(hostname, family, callback) {  // parse arguments
  if (arguments.length === 2) {
    callback = family;
    family = 0;
  } else if (!family) {
    family = 0;
  } else {
    family = +family;
    if (family !== 4 && family !== 6) {
      throw new Error('invalid argument: `family` must be 4 or 6');
    }
  }
  callback = makeAsync(callback);
  callback(null, hostname, family);
};

exports.resolveSrv = function(name, callback) {
  function onanswer(status, result) {
    if (!status) {
     callback(null, result);
    } else {
      callback(errnoException(status, 'resolveSrv'));
    }
  }

  callback = makeAsync(callback);
  var wrap = querySrv(name, onanswer);
  if (!wrap) {
    throw errnoException('EBADARG', 'resolveSrv');
  }

  callback.immediately = true;
  return wrap;
};
