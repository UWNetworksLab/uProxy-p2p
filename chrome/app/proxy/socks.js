/*
  A SOCKS5 proxy that runs in Chrome based on
    https://github.com/gvangool/node-socks

  For the RFC for socks, see:
    http://tools.ietf.org/html/rfc1928
*/
(function(exports) {

  // TODO: move to using freedom sockets.
  //var socket = freedom['core.socket']();

  var socket = chrome.socket;

  var clients = [];
  var SOCKS_VERSION = 0x05;

  /*
   * Authentication methods
   ************************
   * o  X'00' NO AUTHENTICATION REQUIRED
   * o  X'01' GSSAPI
   * o  X'02' USERNAME/PASSWORD
   * o  X'03' to X'7F' IANA ASSIGNED
   * o  X'80' to X'FE' RESERVED FOR PRIVATE METHODS
   * o  X'FF' NO ACCEPTABLE METHODS
   */
  var AUTHENTICATION = {
    NOAUTH: 0x00,
    GSSAPI: 0x01,
    USERPASS: 0x02,
    NONE: 0xFF
  };

  /*
   * o  CMD
   * o  CONNECT X'01'
   * o  BIND X'02'
   * o  UDP ASSOCIATE X'03'
   */
  var REQUEST_CMD = {
    CONNECT: 0x01,
    BIND: 0x02,
    UDP_ASSOCIATE: 0x03
  };

  /*
   * o  ATYP   address type of following address
   * o  IP V4 address: X'01'
   * o  DOMAINNAME: X'03'
   * o  IP V6 address: X'04'
   */
  var ATYP = {
    IP_V4: 0x01,
    DNS: 0x03,
    IP_V6: 0x04
  };

  /*
   * o  REP    Reply field:
   * o  X'00' succeeded
   * o  X'01' general SOCKS server failure
   * o  X'02' connection not allowed by ruleset
   * o  X'03' Network unreachable
   * o  X'04' Host unreachable
   * o  X'05' Connection refused
   * o  X'06' TTL expired
   * o  X'07' Command not supported
   * o  X'08' Address type not supported
   * o  X'09' to X'FF' unassigned
   */
  var SOCKS_RESPONSE = {
    SUCCEEDED: 0x00,
    FAILURE: 0x01,
    NOT_ALLOWED: 0x02,
    NETWORK_UNREACHABLE: 0x03,
    HOST_UNREACHABLE: 0x04,
    CONNECTION_REFUSED: 0x05,
    TTL_EXPIRED: 0x06,
    UNSUPPORTED_COMMAND: 0x07,
    ADDRESS_TYPE: 0x08,
    RESERVED: 0x00
  };

  /**
   * Code to read IP addresses in the SOCKS protocol format.
   */
  var Address = {
    read: function (buffer, offset) {
      if (buffer[offset] == ATYP.IP_V4) {
        return buffer.toString('utf8', buffer[offset+1])
           + '.' + buffer.toString('utf8',buffer[offset+2])
           + '.' + buffer.toString('utf8',buffer[offset+3])
           + '.' + buffer.toString('utf8',buffer[offset+4]);
      } else if (buffer[offset] == ATYP.DNS) {
        return buffer.toString('utf8', offset+2, offset+2+buffer[offset+1]);
      } else if (buffer[offset] == ATYP.IP_V6) {
        return buffer.slice(buffer[offset+1], buffer[offset+1+16]);
      }
    },
    sizeOf: function(buffer, offset) {
      if (buffer[offset] == ATYP.IP_V4) {
        return 4;
      } else if (buffer[offset] == ATYP.DNS) {
        return buffer[offset+1];
      } else if (buffer[offset] == ATYP.IP_V6) {
        return 16;
      }
    }
  };

  /**
   * destination_callback = function(tcpConnection, address, port,
        connectedToDestinationCallback) {...}
   */
  function LocalSocksServer(destinationCallback) {
    var self = this;
    // Holds index from socketId
    this.clients = {};
    this.destinationCallback = destinationCallback;

    this.socksServer = new TcpNetServer("localhost", 1080);
    socksServer.on('listening', function() {
      console.info('LISTENING %s:%s', self.socksServer.addr,
                   self.socksServer.port);
    });
    // Remove from clients on disconnect.
    socksServer.on('disconnect', function(tcpConnection) {
      self.clients[tcpConnection.socketId] = undefined;
    });
    //
    socksServer.on('connection', function(tcpConnection) {
      console.info('CONNECTED %s:%s', tcpConnection.socketInfo.peerAddress,
                   tcpConnection.socketInfo.peerPort);
      self.clients[tcpConnection.socketId] = tcpConnection;
      // When we receieve a request, handle it.
      tcpConnection.on('recv', function(dataChunk) {
        new LocalSocksConnection(tcpConnection, dataChunk,
                                 self.destinationCallback);
      });
    });
  }

  /**
   *
   */
  function LocalSocksConnection(tcpConnection, dataChunk, destinationCallback) {
    this.tcpConnection = tcpConnection;
    this.destinationCallback = destination_callback;
    this.method_count = 0;
    this.auth_methods = [];
    this.address = null;
    this.addressSize = null;
    this.atyp = null;
    this.port = null;
    this.portOffset = null;
    this.dataOffset = null;
    var self = this;
    var response;  // UintArray;

    // We are no longer at waiting for a proxy request on this tcp connection.
    this.tcpConnection.on('recv', null);

    // Only SOCKS Version 5 is supported
    if (dataChunk[0] != SOCKS_VERSION) {
      console.error('handshake: wrong socks version: %d', chunk[0]);
      this.tcpConnection.disconnect();
    }

    // Number of authentication methods
    method_count = dataChunk[1];
    // Get the supported authentication methods.
    // i starts on 1, since we've read dataChunk 0 & 1 already
    for (var i=2; i < method_count + 2; i++) {
      this.auth_methods.push(dataChunk[i]);
    }
    console.log('Supported auth methods: %j', this.auth_methods);

    // Make sure the client supports no authentication.
    if (this.auth_methods.indexOf(AUTHENTICATION.NOAUTH) > -1) {
      console.log('Handing off to handleRequest');
      this.tcpConnection.on('recv', this._handleRequest);
      response = new Uint8Array(2);
      response[0] = SOCKS_VERSION;
      response[1] = AUTHENTICATION.NOAUTH;
      this.tcpConnection.sendRaw(response);
    } else {
      console.error('Unsuported authentication method -- disconnecting');
      response = new Uint8Array(2);
      response[0] = SOCKS_VERSION;
      response[1] = AUTHENTICATION.NONE;
      this.tcpConnection.sendRaw(response);
      this.tcpConnection.disconnect();
    }
  };

  /*
   The SOCKS request is formed as follows:
        +----+-----+-------+------+----------+----------+
        |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
        +----+-----+-------+------+----------+----------+
        | 1  |  1  | X'00' |  1   | Variable |    2     |
        +----+-----+-------+------+----------+----------+

     Where:
          o  VER    protocol version: X'05'
          o  CMD
             o  CONNECT X'01'
             o  BIND X'02'
             o  UDP ASSOCIATE X'03'
          o  RSV    RESERVED
          o  ATYP   address type of following address
             o  IP V4 address: X'01'
             o  DOMAINNAME: X'03'
             o  IP V6 address: X'04'
          o  DST.ADDR       desired destination address
          o  DST.PORT desired destination port in network octet
             order
  */
  LocalSocksConnection.prototype._handleRequest = function (chunk) {
    // We only handle one request per tcp connection.
    this.tcpConnection.on('data', null);
    var response;  // Uint8Array
    var version=chunk[0];

    // Fail if client is not talking Socks version 5.
    if (version !== SOCKS_VERSION) {
      response = new Uint8Array(2);
      response[0] = SOCKS_VERSION;
      response[1] = SOCKS_RESPONSE.FAILURE;
      this.tcpConnection.sendRaw(response);
      this.tcpConnection.disconnect();
      console.error('handleRequest: wrong socks version: %d', version);
      return;
    }

    // Fail unless we got a CONNECT command.
    var cmd=chunk[1];
    if (cmd != REQUEST_CMD.CONNECT) {
      response = new Uint8Array(2);
      response[0] = SOCKS_VERSION;
      response[1] = SOCKS_RESPONSE.UNSUPPORTED_COMMAND;
      this.tcpConnection.sendRaw(response);
      this.tcpConnection.disconnect();
      console.error('handleRequest: unsupported command: %d', cmd);
      return;
    }

    // Parse address and port and set the callback to be handled by the
    // destination proxy (the bit that actually sends data to the destination).
    this.atyp = chunk[4];
    this.addressSize = Address.sizeOf(chunk, 3);
    this.portOffset = addressSize + 5;
    this.address = Address.read(chunk, 3);
    this.port = chunk.readUInt16BE(portOffset);
    this.dataOffset = portOffset + 2;

    console.log('Request: type: %d -- to: %s:%s', cmd, address, port);
    this.request = chunk.subarray(dataOffset, chunk.length - dataOffset);
    // TODO: add a handler for failure to reach destination.
    this.destinationCallback(tcpConnection, this.port, this.address,
        _connectedToDestination.bind(this));
  };

  /**
   * Called when the connection to the final destination site is made.
   * This tells the client the address of the destination reached.
   */
  LocalSocksConnection.prototype._connectedToDestination = function() {
    response = new Uint8Array();
    console.log('Indicating to the client that the proxy is ready');
    // creating response
    response[0] = SOCKS_VERSION;
    response[1] = SOCKS_RESPONSE.SUCCEEDED;
    response[2] = this.atyp;
    for (var i = 0; i < this.addressSize; ++i) {
      response[3 + i] = this.address[i];
    }
    response[this.addressSize + 3] = this.port[0];
    response[this.addressSize + 4] = this.port[1];
    this.tcpConnection.sendRaw(response);
    console.log('Connected to: %s:%d', this.port, this.address);
  };

  exports.LocalSocksServer = LocalSocksServer;
  exports.LocalSocksConnection = LocalSocksConnection;
})(window);
