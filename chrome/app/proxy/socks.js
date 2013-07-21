/*
  A SOCKS5 proxy that runs in Chrome based on
    https://github.com/gvangool/node-socks

  For the RFC for socks, see:
    http://tools.ietf.org/html/rfc1928
*/
'use strict';

(function(exports) {
  // TODO: move to using freedom sockets.
  //var socket = freedom['core.socket']();
  var socket = chrome.socket;

  //----------------------------------------------------------------------------
  // SocksUtil
  //----------------------------------------------------------------------------
  var SocksUtil = {};
  /**
   * version 5 of socks
   * @const {number}
   */
  SocksUtil.VERSION5 = 0x05;

  /*
   * Authentication methods
   ************************
   * o  X'00' NO AUTHENTICATION REQUIRED
   * o  X'01' GSSAPI
   * o  X'02' USERNAME/PASSWORD
   * o  X'03' to X'7F' IANA ASSIGNED
   * o  X'80' to X'FE' RESERVED FOR PRIVATE METHODS
   * o  X'FF' NO ACCEPTABLE METHODS
   *
   * @enum {number}
   */
  SocksUtil.AUTHENTICATION = {
    NOAUTH: 0x00,
    GSSAPI: 0x01,
    USERPASS: 0x02,
    NONE: 0xFF
  };

  /*
   * o  CMD
   * o  CONNECT X'01'        // Connect to tcp
   * o  BIND X'02'           // Listen for tcp
   * o  UDP ASSOCIATE X'03'  // Connect to UDP association
   *
   * @enum {number}
   */
  SocksUtil.REQUEST_CMD = {
    CONNECT: 0x01,
    BIND: 0x02,
    UDP_ASSOCIATE: 0x03
  };

  /*
   * o  ATYP   address type of following address
   * o  IP V4 address: X'01'
   * o  DOMAINNAME: X'03'
   * o  IP V6 address: X'04'
   *
   * @enum {number}
   */
  SocksUtil.ATYP = {
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
   *
   * @enum {number}
   */
  SocksUtil.RESPONSE = {
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
  SocksUtil.interpretSocksRequest = function(byteArray) {
    var result = {};

    if(byteArray.length < 9) {
      return null;
    }

    // Fail if client is not talking Socks version 5.
    result.version = byteArray[0];
    if (result.version !== SocksUtil.VERSION5) {
      result.failure = SocksUtil.RESPONSE.FAILURE;
      return result;
    }

    result.cmd = byteArray[1];
    // Fail unless we got a CONNECT (to TCP) command.
    if (result.cmd != SocksUtil.REQUEST_CMD.CONNECT) {
      result.failure = SocksUtil.RESPONSE.UNSUPPORTED_COMMAND;
      return;
    }

    // Parse address and port and set the callback to be handled by the
    // destination proxy (the bit that actually sends data to the destination).
    result.atyp = byteArray[3];

    if (result.atyp == SocksUtil.ATYP.IP_V4) {
      result.addressSize = 4;
      result.address = byteArray.subarray(4, result.addressSize);
      result.addressString = byteArray[4] + '.' + byteArray[5] + '.' +
          byteArray[6] + '.' + byteArray[7];
      result.portOffset = result.addressSize + 4;
    } else if (result.atyp == SocksUtil.ATYP.DNS) {
      result.addressSize = byteArray[4];
      result.address = byteArray.subarray(5, result.addressSize);
      result.addressString = '';
      for (var i = 0; i < result.addressSize; ++i) {
        result.addressString += String.fromCharCode(byteArray[5 + i]);
      }
      result.portOffset = result.addressSize + 5;
    } else if (result.atyp == SocksUtil.ATYP.IP_V6) {
      result.addressSize = 16;
      result.address = byteArray.subarray(5, result.addressSize);
      var byteDataView = new DataView(byteArray.buffer);
      result.addressString = byteDataView.getUint32(5).toString(16) + '.' +
                             byteDataView.getUint32(5 + 4).toString(16) +
                             byteDataView.getUint32(5 + 8).toString(16) +
                             byteDataView.getUint32(5 + 12).toString(16);
      result.portOffset = result.addressSize + 4;
    } else {
      return null;
    }
    result.portByte1 = byteArray[result.portOffset];
    result.portByte2 = byteArray[result.portOffset + 1];
    result.port = byteArray[result.portOffset] << 8 |
                  byteArray[result.portOffset + 1];
    result.dataOffset = result.portOffset + 2;
    result.raw = byteArray.subarray(0, result.dataOffset);
    result.data = byteArray.subarray(result.dataOffset,
                                     byteArray.length - result.dataOffset);
    console.log(result);
    return result;
  };

  //----------------------------------------------------------------------------
  // SocksServer
  //----------------------------------------------------------------------------
  /**
   * destination_callback = function(tcpConnection, address, port,
        connectedToDestinationCallback) {...}
   */
  function SocksServer(address, port, destinationCallback) {
    var self = this;
    // Holds index from socketId
    this.destinationCallback = destinationCallback;

    this.tcpServer = new window.TcpServer(address || 'localhost',
                                          port || 1080);

    // When we start listening, print it out.
    this.tcpServer.on('listening', function() {
      console.info('LISTENING %s:%d', self.tcpServer.addr,
                   self.tcpServer.port);
    });

    // When we receieve a new connection make a new SocksClientConnection.
    // and log to info.
    this.tcpServer.on('connection', function(tcpConnection) {
      console.info('CONNECTED(%d) %s:%d', tcpConnection.socketId,
          tcpConnection.socketInfo.peerAddress,
          tcpConnection.socketInfo.peerPort);
      tcpConnection.on('recv', function(buffer) {
        console.log('new SocksClientConnection (%s): \n* Got data: %s', tcpConnection.socketId, JSON.stringify(tcpConnection.state()),getHexStringOfArrayBuffer(buffer));
        tcpConnection.socksClient =
            new SocksClientConnection(tcpConnection, buffer,
                                      self.destinationCallback);
      }, {minByteLength: 3});
    });
  }

  SocksServer.prototype.disconnect = function() {
    this.tcpServer.disconnect();
  }

  //----------------------------------------------------------------------------
  // SocksClientConnection
  //----------------------------------------------------------------------------
  /**
   * Connection to a particular socks client
   */
  function SocksClientConnection(tcpConnection, buffer, destinationCallback) {
    this.tcpConnection = tcpConnection;  // to the client.
    this.destinationCallback = destinationCallback;
    this.method_count = 0;
    this.auth_methods = [];
    this.request = null;
    var self = this;
    var response;  // Uint8Array;

    console.log('SocksClientConnection(%d): Auth (length=%d)',
        this.tcpConnection.socketId, buffer.byteLength);

    // We are no longer at waiting for a proxy request on this tcp connection.
    // this.tcpConnection.on('recv', null);

    var byteArray = new Uint8Array(buffer);
    // Only SOCKS Version 5 is supported
    if (byteArray[0] != SocksUtil.VERSION5) {
      console.error('SocksClientConnection(%d): unsupported socks version: %d',
          this.tcpConnection.socketId, byteArray[0]);
      this.tcpConnection.disconnect();
      return;
    }

    // Number of authentication methods
    var methodCount = byteArray[1];
    // Get the supported authentication methods.
    // i starts on 1, since we've read byteArray 0 & 1 already
    for (var i = 2; i < methodCount + 2; i++) {
      this.auth_methods.push(byteArray[i]);
    }
    // Make sure the client supports no authentication.
    if (this.auth_methods.indexOf(SocksUtil.AUTHENTICATION.NOAUTH) <= -1) {
      console.error('SocksClientConnection: no auth methods',
          SocksUtil.AUTHENTICATION.NOAUTH);
      response = new Uint8Array(2);
      response[0] = SocksUtil.VERSION5;
      response[1] = SocksUtil.AUTHENTICATION.NONE;
      this.tcpConnection.sendRaw(response.buffer);
      this.tcpConnection.disconnect();
      return;
    }

    // Handle more data with request handler.
    this.tcpConnection.on('recv', this._handleRequest.bind(this));
    // Send request to use NOAUTH for authentication
    response = new Uint8Array(2);
    response[0] = SocksUtil.VERSION5;
    response[1] = SocksUtil.AUTHENTICATION.NOAUTH;
    this.tcpConnection.sendRaw(response.buffer);
  };

  // Given an array buffer of data (buffer) interpret the SOCKS request.
  SocksClientConnection.prototype._handleRequest = function(buffer) {
    // We only handle one request per tcp connection. Note that pending data
    // will be stored and sent to the next non-null callback.
    this.tcpConnection.on('recv', null);

    console.log(this.tcpConnection);
    console.log('SocksClientConnection(%d): handleRequest\n*got data: %s; \n data: %s', this.tcpConnection.socketId,
      JSON.stringify(this.tcpConnection.state()),
      getHexStringOfArrayBuffer(buffer));

    var byteArray = new Uint8Array(buffer);
    this.result = SocksUtil.interpretSocksRequest(byteArray);

    console.log('SocksClientConnection(%d): parsed request: %s', this.tcpConnection.socketId,
      JSON.stringify(this.result));

    if (this.result == null) {
      console.error('SocksClientConnection(%d): bad request (length %d)',
          this.tcpConnection.socketId, byteArray.length);
      this.tcpConnection.disconnect();
      return;
    } else if ('failure' in this.result) {
      var response = new Uint8Array(2);
      response[0] = SocksUtil.VERSION5;
      response[1] = this.result.failure;
      this.tcpConnection.sendRaw(response.buffer);
      this.tcpConnection.disconnect();
      console.error('SocksClientConnection(%d): unsupported request: %d',
          this.tcpConnection.socketId, this.result.failure);
      return;
    }

    console.log('SocksClientConnection(%d): Request: {cmd:%d, atyp:%d} ' +
        'to: %s:%s',
        this.tcpConnection.socketId,
        this.result.cmd, this.result.atyp, this.result.addressString,
        this.result.port);
    // TODO: add a handler for failure to reach destination.
    this.destinationCallback(this, this.result.address, this.result.port,
        this._connectedToDestination.bind(this));
  };

  /**
   * Called when the connection to the final destination site is made.
   * This tells the client the address of the destination reached.
   */
  SocksClientConnection.prototype._connectedToDestination = function(
      connectionDetails,
      continuation) {
    console.log('SocksClientConnection(%d): ' +
        'connected to destination %s:%d',
        this.tcpConnection.socketId,
        connectionDetails.ipAddrString, connectionDetails.port);
    var response = [];
    // creating response
    response[0] = SocksUtil.VERSION5;
    response[1] = SocksUtil.RESPONSE.SUCCEEDED;
    response[2] = 0x00;
    response[3] = SocksUtil.ATYP.IP_V4;

    var v4 = '([\\d]{1,3})';
    var v4d = '\\.';
    var v4complete = v4+v4d+v4+v4d+v4+v4d+v4
    var v4regex = new RegExp(v4complete);

    var ipv4 = connectionDetails.ipAddrString.match(v4regex);
    if (ipv4) {
      response[4] = parseInt(ipv4[1]);
      response[5] = parseInt(ipv4[2]);
      response[6] = parseInt(ipv4[3]);
      response[7] = parseInt(ipv4[3]);
    }
    // TODO: support IPv6
    response[8] = connectionDetails.port & 0xF0;
    response[9] = connectionDetails.port & 0x0F;
    var responseArray = new Uint8Array(response);
    /* var j = 4;
    if (this.result.atyp == ATYP.DNS) {
      response[j] = this.result.addressSize;
      j++;
    }
    for (var i = 0; i < this.result.addressSize; ++i) {
      response[i + j] = this.result.address[i];
    }
    response[this.result.addressSize + j] = this.result.portByte1;
    response[this.result.addressSize + j + 1] = this.result.portByte2;
    */
    this.tcpConnection.sendRaw(responseArray.buffer);
    if (continuation) { continuation(); }
  };

  //----------------------------------------------------------------------------
  exports.SocksUtil = SocksUtil;
  exports.SocksServer = SocksServer;
  exports.SocksClientConnection = SocksClientConnection;
})(window);
