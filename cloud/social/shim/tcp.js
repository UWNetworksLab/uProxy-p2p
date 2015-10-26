/*jshint node:true, strict:false*/
/* global freedom */

var FreedomTCP = function() {
  this.fd = freedom['core.tcpsocket']();

  // Strongly bind _onRead.
  this._onRead = this._onRead.bind(this);
  this.fd.on("onData", this._onRead);
  this.fd.on('onDisconnect', function() {
    this.onread(-1);
  }.bind(this));

  this.bufferedReads = [];
  this.reading = true;
};

FreedomTCP.prototype._onRead = function(readInfo) {
  var byteview = new Uint8Array(readInfo.data),
      len = readInfo.data.byteLength,
      buf = new Buffer(byteview);

  //View read data for debugging:
  //var str = String.fromCharCode.apply(null, byteview);
  //console.warn('read ' + len +': ' + str);

  if (this.reading) {
    this.onread(len, buf);
  } else {
    this.bufferedReads.push({buf: buf, len: len});
  }
};

FreedomTCP.prototype.close = function(cb) {
  this.fd.off("onData", this._onRead);
  this.fd.close().then(cb);
  this.reading = false;
  this.writing = false;
};

FreedomTCP.prototype.secure = function(cb) {
  this.fd.secure()
      .then(cb, function(e) {
        console.error('Error securing socket: ', e);
      });
};

FreedomTCP.prototype.ref = function() {};
FreedomTCP.prototype.unref = function() {};

FreedomTCP.prototype.readStart = function() {
  var buffer;

  this.reading = true;
  if (this.bufferedReads) {
    // Reading might be stopped while flushing the buffer
    while (this.bufferedReads.length > 0 && this.reading) {
      buffer = this.bufferedReads.shift();
      this.onread(buffer.len, buffer.buf);
    }
  }
};

FreedomTCP.prototype.readStop = function() {
  this.reading = false;
  return false;
};

FreedomTCP.prototype.shutdown = function(cb) {
  this.close(function(cb) {
    cb.oncomplete();
  }.bind({}, cb));
};

FreedomTCP.prototype._writeNative = function(req, data) {
  req.bytes = data.byteLength;
  var promise = this.fd.write(data);
  promise.then(function(len) {
    //console.log("wrote " + length + " chars to socket.");
    req.oncomplete(len, this, req);
  }.bind(this, data.byteLength));
};

FreedomTCP.prototype.writeBuffer = function(req, buf) {
  var data = buf.toArrayBuffer();
  this._writeNative(req, data);
};

FreedomTCP.prototype.writeAsciiString = function(req, s) {
  var data = new Uint8Array(s.length), i = 0;
  for (; i < s.length; i += 1) {
    data[i] = s.charCodeAt(i);
  }
  this._writeNative(req, data);
};

FreedomTCP.prototype.writeUtf8String = function(req, s) {
  //View write data for debugging:
  //console.warn('wrote ' + s.length + ': ' + s);

  var write = function() {
    var data = new Uint8Array(s.length), i = 0;
    for (; i < s.length; i += 1) {
      data[i] = s.charCodeAt(i);
    }
    this._writeNative(req, data);
  }.bind(this);

  if (s === '<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls"/>') {
    // This is a hack to work around issues with secure sockets in Chrome:
    // https://code.google.com/p/chromium/issues/detail?id=403076
    // This will be a no-op in browsers other than Chrome, and should be
    // removed when that issue is fixed.
    // See details at https://github.com/uProxy/uproxy/issues/413
    this.fd.prepareSecure().then(function() {
      write();  // Always write regardless of prepare secure callback
    });
  } else {
    write();
  }
};

FreedomTCP.prototype.writeUcs2String = function(req, s) {
  var data = new Uint8Array(s.length), i = 0;
  for (; i < s.length; i += 1) {
    data[i] = s.charCodeAt(i);
  }
  this._writeNative(req, data);
};

//TODO: support writing multiple chunks together
//FreedomTCP.prototype.writev

//TODO: Support server open/bind/listen.
//FreedomTCP.prototype.open
//FreedomTCP.prototype.bind
//FreedomTCP.prototype.listen

FreedomTCP.prototype.connect = function(cb, address, port) {
  var self = this;
  this.fd.connect(address, port).then(function(status) {
    cb.oncomplete(0, self, cb, true, true);
  }.bind(this));
};

FreedomTCP.prototype.bind6 = FreedomTCP.prototype.bind;
FreedomTCP.prototype.connect6 = FreedomTCP.prototype.connect;

//TODO: implement getsockname / getpeername.
//FreedomTCP.prototype.getsockname
//FreedomTCP.prototype.getpeername
//FreedomTCP.prototype.setNoDelay
//FreedomTCP.prototype.setKeepAlive


exports.TCP = FreedomTCP;
