/**
 * Holds a connection speaking the socks5 protocol.
 *
 * @param {TcpConnection} client The underlying client TCP Connection.
 */
function Socks5Proxy(client) {
	this.client = client;
	this.callbacks = {
		request: null,  // Called when a resource is requested.
		recv: null  // Called when data is received for an outbound connection.
	};
	this.buffer = null;
	this.client.addDataReceivedListener(this._onDataRead.bind(this));
	this.state = SocksState.NEW;
}

const SocksState = {
	NEW: 0,
	CONNECTING: 1,
	CONNECTED: 2,
	ERROR: 3
};

Socks5Proxy.prototype._onDataRead = function(data) {
	if (!this.buffer && data.byteLength && this.state != SocksState.CONNECTED) {
		this.buffer = new Uint8Array(data);
	}

	// Parse Initial Connection Messages.
	if (this.state == SocksState.NEW && this.buffer) {
		if (this.buffer[0] != 5) {
			this._error("Client Handshake was invalid");
		}
		var length = this.buffer[1];
		if (this.buffer.length == length + 2) {
			this.buffer = null;
			this._sendHello();
			this.state = SocksState.CONNECTING;
		} else {
			// For now, fragmented handshake can be treated as an error
			this._error("Client Handshake was fragmented");
		}
	}
	// Parse Connection message.
	else if (this.state == SocksState.CONNECTING && this.buffer) {
		var host = null;
		var port = 0;
		try {
			if (this.buffer[0] != 5 || this.buffer[2] != 0) {
				this._error("Client connect req had invalid protocol.");
			} else if (this.buffer[1] != 1) {
				this._error("Client requested either UDP or to bind a port. Unsupported!");
			}
			var hostType = this.buffer[3];

			var offset = 4;
			if (hostType == 1) { // IPv4
				host = this.buffer[4] + "." + this.buffer[5] + "." + this.buffer[6] + "." + this.buffer[7];
				offset = 8;
			} else if (hostType == 3) { // Domain
				var len = this.buffer[4];
				host = _arrayToStringSynch(this.buffer.subarray(5, 5 + len));
				offset = 5 + len;
			} else if (hostType == 4) { // IPv6
				this._error("TODO: ipv6 support!");
				offset = 20;
			} else {
				this._error("Invalid host specified");
			}
			port = this.buffer[offset] * 256 + this.buffer[offset + 1];
		} catch(e) {
			this._error("Couldn't understand connection request: " + e);
			return;
		}
		this._sendOk();
    this.xmppid = Math.random();
    this.xmppSender({id: this.xmppid, command: "open"});
		this.state = SocksState.CONNECTED;
		this.buffer = null;
		console.log("Connecting to " + host + ":" + port);
	}
	else if (this.state == SocksState.CONNECTED) {
    var msg = {id: this.xmppid, command: "send", data: window.btoa(data)};
		console.log(msg);
    this.xmppSender(msg);
	}
};

Socks5Proxy.prototype._error = function(msg) {
	this.state = SocksState.ERROR;
	console.log("Socks error:" + msg);
	this.client.disconnect();
}

Socks5Proxy.prototype._sendHello = function() {
	var msg = new Uint8Array(2);
	msg[0] = 5; // Version.
	msg[1] = 0; // No Authentication.
	this.client.sendRawMessage(msg.buffer);
};

Socks5Proxy.prototype._sendOk = function() {
	var msg = new Uint8Array(10);
	msg[0] = 5; // version
	msg[1] = 0; // Granted
	msg[2] = 0; // reserved
	// TODO: following host/port are those the final server sees, so that the client knows how it appears.  ipv4/6 address should be used.
	msg[3] = 1; // IPv4

	msg[4] = 127; // Host
	msg[5] = 0;
	msg[6] = 0;
	msg[7] = 1;
	
	msg[8] = 0; // Port
	msg[9] = 0;
	this.client.sendRawMessage(msg.buffer);
}

Socks5Proxy.prototype._setXmppSender = function(sender) {
  this.xmppSender = sender;
}

function _arrayToStringSynch(array) {
	return Array.prototype.map.call(array, function(c) {return String.fromCharCode(c);}).join("");
}
