var tcpServer;

var activeConnections = [];

function handleClientAccept(client) {
	activeConnections.push(new Socks5Proxy(client));
};

function startup() {
	tcpServer = new TcpServer("127.0.0.1", 8123);
	tcpServer.listen(handleClientAccept);
}

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
	if (!this.buffer && data.byteLength) {
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
		if (this.buffer[0] != 5 || this.buffer[2] != 0) {
			this._error("Client connect req had invalid protocol.");
		} else if (this.buffer[1] != 1) {
			this._error("Client requested either UDP or to bind a port. Unsupported!");
		}
		var hostType = this.buffer[3];
		var host = null;
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
		var port = this.buffer[offset] * 256 + this.buffer[offset + 1];

		console.log("Connecting to " + host + ":" + port);
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

function _arrayToStringSynch(array) {
	return Array.prototype.map.call(array, function(c) {return String.fromCharCode(c);}).join("");
}


window.addEventListener('load', startup, true);