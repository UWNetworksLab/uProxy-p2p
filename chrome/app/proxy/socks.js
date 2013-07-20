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
    read: function (biteArray, offset) {
      if (biteArray[offset] == ATYP.IP_V4) {
        return biteArray.toString('utf8', biteArray[offset+1])
           + '.' + biteArray.toString('utf8',biteArray[offset+2])
           + '.' + biteArray.toString('utf8',biteArray[offset+3])
           + '.' + biteArray.toString('utf8',biteArray[offset+4]);
      } else if (biteArray[offset] == ATYP.DNS) {
        return biteArray.toString('utf8', offset+2,
                                  offset+2+biteArray[offset+1]);
      } else if (biteArray[offset] == ATYP.IP_V6) {
        return biteArray.slice(biteArray[offset+1], biteArray[offset+1+16]);
      }
    },
    sizeOf: function(biteArray, offset) {
      if (biteArray[offset] == ATYP.IP_V4) {
        return 4;
      } else if (biteArray[offset] == ATYP.DNS) {
        return biteArray[offset+1];
      } else if (biteArray[offset] == ATYP.IP_V6) {
        return 16;
      }
    }
  };

  /**
   * destination_callback = function(tcpConnection, address, port,
        connectedToDestinationCallback) {...}
   */
  function LocalSocksServer(address, port, destinationCallback) {
    var self = this;
    // Holds index from socketId
    this.clients = {};
    this.destinationCallback = destinationCallback;

    this.tcpServer = new window.TcpServer(address || "localhost",
                                          port || 1080);
    this.tcpServer.on('listening', function() {
      console.info('LISTENING %s:%s', self.tcpServer.addr,
                   self.tcpServer.port);
    });
    // Remove from clients on disconnect.
    this.tcpServer.on('disconnect', function(tcpConnection) {
      self.clients[tcpConnection.socketId] = undefined;
    });
    //
    this.tcpServer.on('connection', function(tcpConnection) {
      console.info('CONNECTED %s:%s', tcpConnection.socketInfo.peerAddress,
                   tcpConnection.socketInfo.peerPort);
      // When we receieve a request, handle it.
      tcpConnection.on('recv', function(buffer) {
        self.clients[tcpConnection.socketId] =
            new LocalSocksConnection(tcpConnection, buffer,
                                     self.destinationCallback);
      });
    });
  }

  /**
   *
   */
  function LocalSocksConnection(tcpConnection, chunk, destinationCallback) {
    this.tcpConnection = tcpConnection;
    this.destinationCallback = destinationCallback;
    this.method_count = 0;
    this.auth_methods = [];
    this.request = null;
    var self = this;
    var response;  // UintArray;

    console.log("LocalSocksConnection(... chunk.length=%d ...)",
        chunk.byteLength);

    // We are no longer at waiting for a proxy request on this tcp connection.
    this.tcpConnection.on('recv', function(chunk) {
        console.log("unexpected data(... chunk.length=%d ...)",
        chunk.byteLength);
    });

    var biteArray = new Uint8Array(chunk);
    // Only SOCKS Version 5 is supported
    if (biteArray[0] != SOCKS_VERSION) {
      console.error('handshake: wrong socks version: %d', biteArray[0]);
      this.tcpConnection.disconnect();
      return;
    }

    // Number of authentication methods
    method_count = biteArray[1];
    // Get the supported authentication methods.
    // i starts on 1, since we've read biteArray 0 & 1 already
    for (var i=2; i < method_count + 2; i++) {
      this.auth_methods.push(biteArray[i]);
    }
    console.log('Supported auth methods: ', this.auth_methods);

    // Make sure the client supports no authentication.
    if (this.auth_methods.indexOf(AUTHENTICATION.NOAUTH) <= -1) {
      console.error('Unsuported authentication method -- disconnecting');
      response = new Uint8Array(2);
      response[0] = SOCKS_VERSION;
      response[1] = AUTHENTICATION.NONE;
      this.tcpConnection.sendRaw(response.buffer);
      this.tcpConnection.disconnect();
      return;
    }

    //
    console.log('Handing off to handleRequest');
    this.tcpConnection.on('recv', this._handleRequest.bind(this));
    response = new Uint8Array(2);
    response[0] = SOCKS_VERSION;
    response[1] = AUTHENTICATION.NOAUTH;
    this.tcpConnection.sendRaw(response.buffer);
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
  interpretSocksRequest = function(biteArray) {
    var result = {};

    // Fail if client is not talking Socks version 5.
    var version=biteArray[0];
    if (version !== SOCKS_VERSION) {
      result.failure = SOCKS_RESPONSE.FAILURE;
      return result;
    }

    // Fail unless we got a CONNECT command.
    var cmd=biteArray[1];
    if (cmd != REQUEST_CMD.CONNECT) {
      result.failure = SOCKS_RESPONSE.UNSUPPORTED_COMMAND;
      return result;
    }
    result.cmd = cmd;

    // Parse address and port and set the callback to be handled by the
    // destination proxy (the bit that actually sends data to the destination).
    result.atyp = biteArray[4];
    result.addressSize = Address.sizeOf(biteArray, 3);
    result.portOffset = result.addressSize + 5;
    result.address = Address.read(biteArray, 3);
    result.port = biteArray[result.portOffset] << 8
                  + biteArray[result.portOffset + 1];
    result.dataOffset = result.portOffset + 2;
    result.data = biteArray.subarray(result.dataOffset,
                                     biteArray.length - result.dataOffset);
    return result;
  }

  LocalSocksConnection.prototype._handleRequest = function (chunk) {
    // We only handle one request per tcp connection.
    this.tcpConnection.on('recv', null);

    biteArray = new Uint8Array(chunk);
    this.result = interpretSocksRequest(biteArray);
    if('failure' in this.result) {
      response = new Uint8Array(2);
      response[0] = SOCKS_VERSION;
      response[1] = this.result.failure;
      this.tcpConnection.sendRaw(response.buffer);
      this.tcpConnection.disconnect();
      console.error('handleRequest failed with error: %d', this.result.failure);
      return;
    }

    console.log('Request: type: %d -- to: %s:%s', this.result.cmd,
        this.result.address, this.result.port);
    // TODO: add a handler for failure to reach destination.
    this.destinationCallback(this.tcpConnection, this.result.port,
        this.result.address, this._connectedToDestination.bind(this));
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
    response[2] = this.result.atyp;
    for (var i = 0; i < this.result.addressSize; ++i) {
      response[3 + i] = this.result.address[i];
    }
    response[this.result.addressSize + 3] = this.result.port & 0x0F;
    response[this.result.addressSize + 4] = this.result.port & 0xF0;
    this.tcpConnection.sendRaw(response.buffer);
    console.log('Connected to: %s:%d', this.result.address, this.result.port);
  };

  exports.LocalSocksServer = LocalSocksServer;
  exports.LocalSocksConnection = LocalSocksConnection;
})(window);
