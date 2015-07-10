/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/freedom-typings/udp-socket.d.ts' />
/// <reference path='../../../third_party/sha1/sha1.d.ts' />
/// <reference path='../../../third_party/typings/lodash/lodash.d.ts' />
/// <reference path='../../../third_party/typings/generic/url.d.ts' />
/// <reference path='../../../third_party/ipaddrjs/ipaddrjs.d.ts' />


import arraybuffers = require('../../../third_party/uproxy-lib/arraybuffers/arraybuffers');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import _ = require('lodash');
import globals = require('./globals');
import sha1 = require('crypto/sha1');
import ipaddr = require('ipaddr.js');

// Both Ping and NAT type detection need help from a server. The following
// ip/port is the instance we run on EC2.
var TEST_SERVER = '54.68.73.184';
var TEST_PORT = 6666;

var log :logging.Log = new logging.Log('Diagnose');

/**
 * Utilities for decoding and encoding STUN messages.
 * TURN uses STUN messages, adding some methods and attributes.
 *
 * http://tools.ietf.org/html/rfc5389#section-6
 */
module Turn {
  /** A STUN/TURN message, used for requests and responses. */
  export interface StunMessage {
    method :MessageMethod;
    clazz :MessageClass;
    // Subarrays are much faster than encoding and decoding to a string.
    transactionId :Uint8Array;
    attributes :StunAttribute[];
  }

  /** A STUN/TURN attribute, which carries data in a message. */
  export interface StunAttribute {
    type :number;
    value ?:Uint8Array;
  }

  /**
   * Primary purpose of a request.
   * The values here are a subset of what's defined for STUN and TURN.
   * STUN only defines one method: BIND.
   * TURN adds several more methods:
   *   http://tools.ietf.org/html/rfc5766#section-13
   */
  export enum MessageMethod {
    BIND = 1, // STUN's method; unsupported here, though Chrome tries it
    ALLOCATE = 3,
    REFRESH = 4,
    SEND = 6,
    DATA = 7,
    CREATE_PERMISSION = 8,
    CHANNEL_BIND = 9
  }

  /**
   * This is orthogonal to method. Probably best to read:
   *   http://tools.ietf.org/html/rfc5389#section-6
   */
  export enum MessageClass {
    REQUEST = 1,
    SUCCESS_RESPONSE = 2,
    FAILURE_RESPONSE = 3,
    INDICATION = 4
  }

  /**
   * STUN/TURN attributes in which we are interested:
   *   http://tools.ietf.org/html/rfc5389#section-15
   *   http://tools.ietf.org/html/rfc5766#section-14
   */
  export enum MessageAttribute {
    MAPPED_ADDRESS = 0x01,
    USERNAME = 0x06,
    MESSAGE_INTEGRITY = 0x08,
    ERROR_CODE = 0x09,
    XOR_PEER_ADDRESS = 0x12,
    DATA = 0x13,
    REALM = 0x14,
    NONCE = 0x15,
    XOR_RELAYED_ADDRESS = 0x16,
    REQUESTED_TRANSPORT = 0x19,
    XOR_MAPPED_ADDRESS = 0x20,
    LIFETIME = 0x0d,
    /**
     * This attribute is appended to messages sent from one side of the
     * TURN server to the other. For performance reasons we do not always
     * strip this attribute before a message is relayed to a client; the
     * value chosen lies within the "comprehension-optional" and undefined
     * ranges which means that TURN clients should feel free to ignore it
     * and the attribute should not interfere with ICE:
     *   http://tools.ietf.org/html/rfc5389#section-18.2
     *   http://www.iana.org/assignments/stun-parameters/stun-parameters.xhtml
     */
    IPC_TAG = 0xeeff
  }

  /** Represents a host:port combination. */
  export interface Endpoint {
    address:string;
    port:number;
  }

  /**
   * Username with which our HMAC_KEY was generated. Clients will need to use
   * this to access the server.
   */
  export var USERNAME = 'test';

  /**
   * Password with which our HMAC_KEY was generated. Clients will need to use
   * this to access the server.
   */
  export var PASSWORD = 'test';

  /**
   * Realm for this server. Has no real meaning -- but this is used as part of
   * message signing (see HMAC_KEY).
   */
  export var REALM = 'myrealm';

  /**
   * Key for the HMAC algorithm with which we must sign STUN responses:
   *   http://tools.ietf.org/html/rfc5389#section-15.4
   *
   * The key is defined as:
   *   md5(username:realm:SASLprep(password))
   *
   * Currently, since the server has just one user (test), our key, pre-hashing,
   * is effectively fixed as:
   *   test:myrealm:test
   *
   * The hash can be easily generated on a Unix command-line:
   *   echo -n 'test:myrealm:test'|md5sum
   *   bd8adb317d5d542e5e2aba5bdb8f5ca2
   *
   * Wireshark-ing a TURN session with rfc5766-turn-server reveals that the key
   * must be input to the HMAC algorithm as 16 bytes of *binary* data. So, we
   * supply our crypto library with a UTF-8 string generated from the 16 bytes.
   */
   // TODO: dynamic username/password would be pretty easy to implement
   // TODO: would be nice to run uint8array -> string on boot but the files
   //       don't seem to load in the right order...might be a typescript bug
   var HMAC_KEY = new Uint8Array([
     0xbd, 0x8a, 0xdb, 0x31,
     0x7d, 0x5d, 0x54, 0x2e,
     0x5e, 0x2a, 0xba, 0x5b,
     0xdb, 0x8f, 0x5c, 0xa2
   ]);

  /**
   * Returns the "magic cookie" bytes:
   *   http://tools.ietf.org/html/rfc5389#section-6
   */
  function getMagicCookieBytes() : Uint8Array {
    return new Uint8Array([0x21, 0x12, 0xa4, 0x42]);
  }

  /**
   * Parses a byte array, returning a StunMessage object.
   * Throws an error if this is not a STUN request.
   */
  export function parseStunMessage(bytes:Uint8Array) : StunMessage {
    // Fail if the request is too short to be valid.
    if (bytes.length < 20) {
      throw new Error('request too short');
    }

    // From:
    //   http://tools.ietf.org/html/rfc5389#section-6
    // The first two bytes of the header are pretty weird, as the bits for
    // class and method are interleaved. Here's a breakdown:
    //   0                 1
    //   0 1 2  3  4 5 6 7 8 9 0 1 2 3 4 5
    //   +-+-+--+--+-+-+-+-+-+-+-+-+-+-+-+-+
    //   | | |M |M |M|M|M|C|M|M|M|C|M|M|M|M|
    //   | | |11|10|9|8|7|1|6|5|4|0|3|2|1|0|
    //   +-+-+--+--+-+-+-+-+-+-+-+-+-+-+-+-+

    // Fail if the first two bits of the most significant byte are not zero.
    if (bytes[0] & 0xc0) {
      throw new Error('first two bits must be zero');
    }

    // Fail if the magic cookie is not present.
    if (bytes[4] != 0x21 || bytes[5] != 0x12 ||
        bytes[6] != 0xa4 || bytes[7] != 0x42) {
      throw new Error('magic cookie not found');
    }

    // The class is determined by bits C1 and C0.
    var c1 = bytes[0] & 0x01;
    var c0 = bytes[1] & 0x10;
    var clazz :MessageClass;
    if (c1) {
      if (c0) {
        clazz = MessageClass.FAILURE_RESPONSE;
      } else {
        clazz = MessageClass.SUCCESS_RESPONSE;
      }
    } else if (c0) {
      clazz = MessageClass.INDICATION;
    } else {
      clazz = MessageClass.REQUEST;
    }

    // The method is determined by bits M0 through M12.
    // Though TURN's highest-numbered method is only 9, let's do all 12 bits
    // for the sake of completeness.
    // M0-M3.
    var method:number = bytes[1] & 0x0f;
    // M4-M6.
    method |= (bytes[1] >> 1) & 0x70;
    // M7-M12.
    method |= (bytes[0] << 6) & 0x0f80;

    // Transaction ID.
    var transactionId = bytes.subarray(8, 20);

    // Attributes.
    var attributes :StunAttribute[] = [];
    var attributeOffset = 20;
    while (attributeOffset < bytes.length) {
      var attribute = parseStunAttribute(bytes.subarray(attributeOffset));
      attributes.push(attribute);
      attributeOffset += 4 + calculatePadding((attribute.value ?
          attribute.value.length : 0), 4);
    }

    return {
      clazz: clazz,
      method: method,
      transactionId: transactionId,
      attributes: attributes
    }
  }

  /**
   * Constructs a byte array from a StunMessage object.
   */
  export function formatStunMessage(message:StunMessage) : Uint8Array {
    // Figure out how many bytes we'll need.
    var length = 0;
    for (var i = 0; i < message.attributes.length; i++) {
      var declaredLength = message.attributes[i].value ?
          message.attributes[i].value.length : 0;
      var paddedLength = calculatePadding(declaredLength, 4);
      length += (4 + paddedLength);
    }

    var buff = new ArrayBuffer(length + 20);
    var bytes = new Uint8Array(buff);

    // The first two bytes of the header are pretty weird, as the bits for
    // class and method are interleaved. Here's a breakdown:
    //   0                 1
    //   0 1 2  3  4 5 6 7 8 9 0 1 2 3 4 5
    //   +-+-+--+--+-+-+-+-+-+-+-+-+-+-+-+-+
    //   | | |M |M |M|M|M|C|M|M|M|C|M|M|M|M|
    //   | | |11|10|9|8|7|1|6|5|4|0|3|2|1|0|
    //   +-+-+--+--+-+-+-+-+-+-+-+-+-+-+-+-+

    // Method (M0-M12).
    // M0-M3.
    bytes[1] = message.method & 0xff;
    // M4-M6.
    bytes[1] |= (message.method << 1) & 0xe0;
    // M7-M12.
    bytes[0] = (message.method << 2) & 0x3e00;

    // Class (C1 and C0).
    var c1 = bytes[0] & 0x01;
    var c0 = bytes[1] & 0x10;
    var clazz :MessageClass;
    // C1.
    if (message.clazz == MessageClass.SUCCESS_RESPONSE ||
        message.clazz == MessageClass.FAILURE_RESPONSE) {
      bytes[0] |= 0x01;
    }
    // C0.
    if (message.clazz == MessageClass.INDICATION ||
        message.clazz == MessageClass.FAILURE_RESPONSE) {
      bytes[1] |= 0x10;
    }

    // Length.
    bytes[2] = length >> 8;
    bytes[3] = length & 0xff;

    // Magic cookie.
    bytes.set(getMagicCookieBytes(), 4);

    // Transaction ID.
    bytes.set(message.transactionId, 8);

    // Attributes.
    var attributeOffset = 20;
    for (var i = 0; i < message.attributes.length; i++) {
      var attribute = message.attributes[i];
      attributeOffset += formatStunAttribute(attribute,
          bytes.subarray(attributeOffset));
    }

    return bytes;
  }

  /**
   * As formatStunMessage() but appends a MESSAGE-INTEGRITY attribute.
   * Normally, this is the function you should call; the exceptions are tests
   * and send/data indications (which do not require a checksum).
   */
  export function formatStunMessageWithIntegrity(message:Turn.StunMessage) : Uint8Array {
    // Append the attribute and obtain the bytes...
    message.attributes.push({
      type: Turn.MessageAttribute.MESSAGE_INTEGRITY,
      value: new Uint8Array(20)
    });
    var bytes = formatStunMessage(message);

    // ...and compute the checksum, and copy it into the bytes.
    // MESSAGE-INTEGRITY hashes are always 20 bytes in length.
    var hashBytes = computeHash(bytes);
    bytes.set(hashBytes, bytes.length - 20);

    return bytes;
  }

  /**
   * Computes the hash for the MESSAGE-INTEGRITY attribute:
   *   http://tools.ietf.org/html/rfc5389#section-15.4
   *
   * From the RFC:
   *   "The text used as input to HMAC is the STUN message, including
   *   the header, up to and including the attribute preceding the
   *   MESSAGE-INTEGRITY attribute."
   *
   * The supplied bytes should be a STUN message, including a MESSAGE-INTEGRITY
   * attribute (which must be the final attribute), with length including that
   * attribute.
   *
   * Callers of this method should copy the computed hash into the
   * supplied byte array.
   */
  export function computeHash(bytes:Uint8Array) : Uint8Array {
    var keyAsString = arraybuffers.arrayBufferToString(HMAC_KEY.buffer);
    // MESSAGE-INTEGRITY attributes are always 24 bytes long:
    // 4 bytes header + 20 bytes hash
    var bytesToBeHashed = bytes.subarray(0, bytes.byteLength - 24);
    // Think of the next few lines as uint8ArrayToString().
    // This is necessary because, depending on how b is constructed,
    // b.buffer is not guaranteed to equal a, where b is a Uint8Array
    // view on an ArrayBuffer a (in particular, views created with
    // subarray will share the same parent ArrayBuffer).
    // TODO: add uint8ArrayToString to uproxy-build-tools
    var a :string[] = [];
    for (var i = 0; i < bytesToBeHashed.length; ++i) {
      a.push(String.fromCharCode(bytes[i]));
    }
    var bytesToBeHashedAsString = a.join('');

    var hashAsString = sha1.str_hmac_sha1(keyAsString,
        bytesToBeHashedAsString);
    return new Uint8Array(arraybuffers.stringToArrayBuffer(hashAsString));
  }

  /**
   * Converts the supplied attribute to bytes, placing the result in the
   * supplied byte array. Throws an error if the byte array is too small
   * to contain the attribute but otherwise ignores any trailing bytes.
   */
  export function formatStunAttribute(
      attr:Turn.StunAttribute,
      bytes:Uint8Array) : number {
    var paddedLength = calculatePadding(attr.value ? attr.value.length : 0, 4);
    if (bytes.length < 4 + paddedLength) {
      throw new Error('too few bytes');
    }

    // Type.
    bytes[0] = attr.type >> 8;
    bytes[1] = attr.type & 0xff;

    // Length.
    var length = attr.value ? attr.value.length : 0;
    bytes[2] = length >> 8;
    bytes[3] = length & 0xff;

    // Value.
    if (attr.value) {
      bytes.set(attr.value, 4);
      // Padding.
      for (var i = attr.value.length; i < paddedLength; i++) {
        bytes[4 + i] = 0;
      }
    }

    return 4 + paddedLength;
  }

  /**
   * Parses a STUN attribute:
   *   http://tools.ietf.org/html/rfc5389#section-15
   */
  export function parseStunAttribute(bytes:Uint8Array) : Turn.StunAttribute {
    // Fail if the number of bytes is too small.
    if (bytes.length < 4) {
      throw new Error('too few bytes');
    }

    var type = bytes[0] << 8 | bytes[1];
    var length = bytes[2] << 8 | bytes[3];
    var value :Uint8Array;
    if (length > 0) {
      value = bytes.subarray(4, 4 + length);
    }

    return {
      type : type,
      value : value
    };
  }

  /**
   * Returns bytes suitable for use in a ERROR_CODE-typed StunAttribute:
   *   http://tools.ietf.org/html/rfc5389#section-15.6
   */
  export function formatErrorCodeAttribute(
      code:number,
      reason:string) : Uint8Array {
    // TODO: check reason length is <128 characters
    var length = 4 + reason.length;
    var buffer = new ArrayBuffer(length);
    var bytes = new Uint8Array(buffer);
    // Reserved bits.
    bytes[0] = bytes[1] = bytes[2] = 0;
    // Class (hundreds digit of code).
    var clazz = code / 100;
    if (clazz < 3 || clazz > 6) {
      throw new Error('class must be between 3 and 6');
    }
    bytes[2] = clazz;
    // Number (code modulo 100).
    bytes[3] = code % 100;
    // Reason.
    var reasonBuffer = arraybuffers.stringToArrayBuffer(reason);
    bytes.set(new Uint8Array(reasonBuffer), 4);
    return bytes;
  }

  /**
   * Returns bytes suitable for use in a MAPPED-ADDRESS attribute:
   *   http://tools.ietf.org/html/rfc5389#section-15.1
   * Although we never send MAPPED-ADDRESS attributes, this function is
   * useful for testing and formatting XOR-MAPPED-ADDRESS attributes.
   * TODO: support IPv6 (assumes IPv4)
   */
  export function formatMappedAddressAttribute(
      address:string,
      port:number) : Uint8Array {
    var buffer = new ArrayBuffer(8);
    var bytes = new Uint8Array(buffer);

    bytes[0] = 0; // reserved
    bytes[1] = 0x01; // IPv4

    // Port.
    bytes[2] = port >> 8;
    bytes[3] = port & 0xff;

    // Address.
    var s = address.split('.');
    if (s.length != 4) {
      throw new Error('cannot parse address ' + address);
    }
    for (var i = 0; i < 4; i++) {
      bytes[4 + i] = parseInt(s[i]);
    }

    return bytes;
  }

  /**
   * Parses a MAPPED-ADDRESS attribute:
   *   http://tools.ietf.org/html/rfc5389#section-15.1
   * Again, although we never parse MAPPED-ADDRESS attributes, this function is
   * useful for testing and for parsing XOR-MAPPED-ADDRESS attributes.
   * TODO: support IPv6 (assumes IPv4)
   */
  export function parseMappedAddressAttribute(bytes:Uint8Array) : Turn.Endpoint {
    if (bytes.length < 8) {
      throw new Error('attribute too short');
    }

    if (bytes[0]) {
      throw new Error('first byte must be zero');
    }

    if (bytes[1] != 0x01) {
      throw new Error('only ipv4 supported');
    }

    // Port.
    var port = (bytes[2] << 8) | bytes[3];

    // Address.
    var quadrants = [bytes[4], bytes[5], bytes[6], bytes[7]];
    var address = quadrants.join('.');

    return {
      address: address,
      port: port
    };
  }

  /**
   * Parses an XOR-MAPPED-ADDRESS attribute:
   *   http://tools.ietf.org/html/rfc5389#section-15.2
   * TODO: support IPv6 (assumes IPv4)
   */
  export function parseXorMappedAddressAttribute(bytes:Uint8Array) : Turn.Endpoint {
    if (bytes.length < 8) {
      throw new Error('attribute too short');
    }

    // Port.
    var magicCookieBytes = getMagicCookieBytes();
    bytes[2] ^= magicCookieBytes[0]; // most significant byte
    bytes[3] ^= magicCookieBytes[1]; // least significant byte

    // Address.
    for (var i = 0; i < 4; i++) {
      bytes[4 + i] ^= magicCookieBytes[i];
    }
    return parseMappedAddressAttribute(bytes);
  }

  /**
   * Returns bytes suitable for use in XOR-MAPPED-ADDRESS and
   * XOR-RELAYED-ADDRESS attributes:
   *   http://tools.ietf.org/html/rfc5389#section-15.2
   * TODO: support IPv6 (assumes IPv4)
   */
  export function formatXorMappedAddressAttribute(
      address:string,
      port:number) : Uint8Array {
    var bytes = formatMappedAddressAttribute(address, port);

    // From the RFC:
    //   "X-Port is computed by taking the mapped port in host byte order,
    //   XOR'ing it with the most significant 16 bits of the magic cookie,
    //   and then the converting the result to network byte order."
    // It's not clear why you would XOR the host byte ordered-representation
    // so we just XOR the network byte representation. Examining the network
    // traffic with Wireshark indicates that this is correct.

    var magicCookie = getMagicCookieBytes();
    bytes[2] ^= magicCookie[0];
    bytes[3] ^= magicCookie[1];

    // Address.
    for (var i = 0; i < 4; i++) {
      bytes[4 + i] ^= magicCookie[i];
    }

    return bytes;
  }

  /**
   * Returns the first attribute in the supplied array having the
   * specified type. Raises an error if the attribute is not found.
   */
  export function findFirstAttributeWithType(
    type:Turn.MessageAttribute,
    attributes:Turn.StunAttribute[]) : Turn.StunAttribute {
    for (var i = 0; i < attributes.length; i++) {
      var attribute = attributes[i];
      if (attribute.type === type) {
        return attribute;
      }
    }
    throw new Error('attribute not found');
  }

  /** Rounds x up to the nearest b, e.g. calculatePadding(5, 4) == 8. */
  export function calculatePadding(x:number, b:number) : number {
    var t = Math.floor(x / b);
    if ((x % b) > 0) {
      t++;
    }
    return t * b;
  }
}  // module Turn

export function doUdpTest() {
  log.info('perform udp test');
  var socket :freedom_UdpSocket.Socket = freedom['core.udpsocket']();

  function onUdpData(info :freedom_UdpSocket.RecvFromInfo) {
    var rspStr = arraybuffers.arrayBufferToString(info.data);
    log.debug(rspStr);

    var rsp = JSON.parse(rspStr);
    if (rsp['answer'] == 'Pong') {
      console.debug('Pong resonse received, latency=' +
            (Date.now() - rsp['ping_time']) + 'ms')
    }
  }

  socket.bind('0.0.0.0', 0)
      .then(socket.getInfo)
      .then((socketInfo: freedom_UdpSocket.SocketInfo) => {
        log.debug('listening on %1:%2',
                  [socketInfo.localAddress, socketInfo.localPort]);
      })
      .then(() => {
        socket.on('onData', onUdpData);
        var pingReq = new Uint32Array(1);
        var reqStr = JSON.stringify({
          'ask': 'Ping',
          'ping_time': Date.now()
        });
        var req = arraybuffers.stringToArrayBuffer(reqStr);
        socket.sendTo(req, TEST_SERVER, TEST_PORT);
      }).catch((err) => {
        return Promise.reject(new Error('listen failed to bind :5758' +
              ' with error ' + err.message));
      });
}

function doStunAccessTest() {
  var stunServers = <string[]>_(globals.settings.stunServers).map('urls').flatten().value();
  log.info('perform Stun access test');
  for (var i = 0; i < stunServers.length; i++) {
    var promises : Promise<number>[] = [];
    for (var j = 0; j < 5; j++) {
      promises.push(pingStunServer(stunServers[i]));
    }
    Promise.all(promises).then((laterncies: Array<number>) => {
      var server = stunServers[i];
      var total = 0;
      for (var k = 0; k < laterncies.length; k++) {
        total += laterncies[k];
      }
      console.debug('Average laterncy for ' + stunServers[i] +
            ' = ' + total / laterncies.length);
    });
  }
}

function pingStunServer(serverAddr: string) {
  return new Promise<number>( (F, R) => {
    var socket:freedom_UdpSocket.Socket = freedom['core.udpsocket']();
    var parts = serverAddr.split(':');
    var start = Date.now();

    var bindRequest :Turn.StunMessage = {
      method: Turn.MessageMethod.BIND,
      clazz:  Turn.MessageClass.REQUEST,
      transactionId: new Uint8Array(12),
      attributes: []
    };

    var uint16View = new Uint16Array(bindRequest.transactionId);
    for (var i = 0; i < 6; i++) {
      uint16View[i] = Math.floor(Math.random() * 65535);
    }

    socket.on('onData', (info :freedom_UdpSocket.RecvFromInfo) => {
      try {
        var response = Turn.parseStunMessage(new Uint8Array(info.data));
      } catch (e) {
        log.error('Failed to parse bind request from %1', [serverAddr]);
        R(e);
        return;
      }
      var attribute = Turn.findFirstAttributeWithType(
          Turn.MessageAttribute.XOR_MAPPED_ADDRESS, response.attributes);
      var endPoint = Turn.parseXorMappedAddressAttribute(attribute.value);
      var laterncy = Date.now() - start;
      console.debug(serverAddr + ' returned in ' + laterncy + 'ms. ' +
            'report reflexive address: ' + JSON.stringify(endPoint));
      F(laterncy);
    });

    var bytes = Turn.formatStunMessage(bindRequest);
    socket.bind('0.0.0.0', 0)
        .then(() => {
          return socket.sendTo(bytes.buffer, parts[1], parseInt(parts[2]));
        }).then((written: number) => {
            log.debug('%1 bytes sent correctly', [written]);
        }).catch((e: Error) => {
            log.debug(JSON.stringify(e));
            R(e);
        });
  });
}

// The following code needs the help from a server to do its job. The server
// code can be found jsonserv.py in the same repository. One instance is
// running in EC2.
export function doNatProvoking() :Promise<string> {
  return new Promise((F, R) => {
    log.info('perform NAT provoking');
    var socket: freedom_UdpSocket.Socket = freedom['core.udpsocket']();
    var timerId: number = -1;

    var rejectShortcut: (e: any) => void = null;

    function onUdpData(info: freedom_UdpSocket.RecvFromInfo) {
      var rspStr: string = arraybuffers.arrayBufferToString(info.data);
      log.debug('receive response = ' + rspStr);

      var rsp = JSON.parse(rspStr);

      if (rsp['answer'] == 'FullCone') {
        F('full-cone NAT');
      } else if (rsp['answer'] == 'RestrictedConePrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var req: ArrayBuffer = arraybuffers.stringToArrayBuffer('{"ask":""}');
        log.debug('reply to RestrictedConePrepare');
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] == 'RestrictedCone') {
        F('restricted-cone NAT');
      } else if (rsp['answer'] == 'PortRestrictedConePrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var req: ArrayBuffer = arraybuffers.stringToArrayBuffer('{"ask":""}');
        log.debug('reply to PortRestrictedConePrepare');
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] == 'PortRestrictedCone') {
        F('port-restricted cone NAT');
      } else if (rsp['answer'] == 'SymmetricNATPrepare') {
        var peer_addr: string[] = rsp['prepare_peer'].split(':');
        var reqStr: string = JSON.stringify({ 'ask': 'AmISymmetricNAT' });
        var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
        socket.sendTo(req, peer_addr[0], parseInt(peer_addr[1]));
        return;
      } else if (rsp['answer'] == 'SymmetricNAT') {
        F('symmetric NAT');
      } else {
        return;
      }

      if (timerId != -1) {
        clearTimeout(timerId);
        if (rejectShortcut) {
          rejectShortcut(new Error('shortCircuit'));
        }
      }
    }

    socket.on('onData', onUdpData);

    socket.bind('0.0.0.0', 0)
        .then(socket.getInfo)
        .then((socketInfo: freedom_UdpSocket.SocketInfo) => {
          log.debug('listening on %1:%2',
                    [socketInfo.localAddress, socketInfo.localPort]);
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmIFullCone' });
          log.debug('send ' + reqStr);
          var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 10; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 2000);
          });
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmIRestrictedCone' });
          log.debug(reqStr);
          var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 3; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 3000);
          });
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmIPortRestrictedCone' });
          log.debug(reqStr);
          var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 3; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 10000);
          });
        })
        .then(() => {
          var reqStr: string = JSON.stringify({ 'ask': 'AmISymmetricNAT' });
          log.debug(reqStr);
          var req: ArrayBuffer = arraybuffers.stringToArrayBuffer(reqStr);
          for (var i = 0; i < 3; i++) {
            socket.sendTo(req, TEST_SERVER, TEST_PORT);
          }
        })
        .then(() => {
          return new Promise<void>((F, R) => {
            rejectShortcut = R;
            timerId = setTimeout(() => {
              timerId = -1;
              F();
            }, 3000);
          });
        })
        .catch((e: Error) => {
          if (e.message != 'shortCircuit') {
            log.error('something wrong: ' + e.message);
            R(e);
          } else {
            log.debug('shortCircuit');
          }
        });
  });
}

// Closes the OS-level sockets and discards its Freedom object
function closeSocket(socket:freedom_UdpSocket.Socket) {
  socket.destroy().then(() => {
    freedom['core.udpsocket'].close(socket);
  });
}

// Test if NAT-PMP is supported by the router, returns a boolean
export function probePmpSupport(routerIp:string, privateIp:string) :Promise<boolean> {
  var socket :freedom_UdpSocket.Socket;
  var _probePmpSupport = new Promise((F, R) => {
    socket = freedom['core.udpsocket']();

    // Fulfill when we get any reply (failure is on timeout in wrapper function)
    socket.on('onData', (pmpResponse:freedom_UdpSocket.RecvFromInfo) => {
      closeSocket(socket);
      F(true);
    });

    // Bind a UDP port and send a NAT-PMP request
    socket.bind('0.0.0.0', 0).
        then(() => {
          // Construct the NAT-PMP map request as an ArrayBuffer
          // Map internal port 55555 to external port 55555 w/ 120 sec lifetime
          var pmpBuffer = new ArrayBuffer(12);
          var pmpView = new DataView(pmpBuffer);
          // Version and OP fields (1 byte each)
          pmpView.setInt8(0, 0);
          pmpView.setInt8(1, 1);
          // Reserved, internal port, external port fields (2 bytes each)
          pmpView.setInt16(2, 0, false);
          pmpView.setInt16(4, 55555, false);
          pmpView.setInt16(6, 55555, false);
          // Mapping lifetime field (4 bytes)
          pmpView.setInt32(8, 120, false);

          socket.sendTo(pmpBuffer, routerIp, 5351);
        }).catch((err) => {
          R(new Error('Failed to bind to a port: ' + err.message));
        });
  });

  // Give _probePmpSupport 2 seconds before timing out
  return Promise.race([
    countdownFulfill(2000, false, () => { closeSocket(socket); }),
    _probePmpSupport
  ]);
}

// Test if PCP is supported by the router, returns a boolean
export function probePcpSupport(routerIp:string, privateIp:string) :Promise<boolean> {
  var socket :freedom_UdpSocket.Socket;
  var _probePcpSupport = new Promise((F, R) => {
    socket = freedom['core.udpsocket']();

    // Fulfill when we get any reply (failure is on timeout in wrapper function)
    socket.on('onData', (pcpResponse:freedom_UdpSocket.RecvFromInfo) => {
      closeSocket(socket);
      F(true);
    });

    // Bind a UDP port and send a PCP request
    socket.bind('0.0.0.0', 0).
        then(() => {
          // Create the PCP MAP request as an ArrayBuffer
          // Map internal port 55556 to external port 55556 w/ 120 sec lifetime
          var pcpBuffer = new ArrayBuffer(60);
          var pcpView = new DataView(pcpBuffer);
          // Version field (1 byte)
          pcpView.setInt8(0, 0b00000010);
          // R and Opcode fields (1 bit + 7 bits)
          pcpView.setInt8(1, 0b00000001);
          // Reserved field (2 bytes)
          pcpView.setInt16(2, 0, false);
          // Requested lifetime (4 bytes)
          pcpView.setInt32(4, 120, false);
          // Client IP address (128 bytes; we use the IPv4 -> IPv6 mapping)
          pcpView.setInt32(8, 0, false);
          pcpView.setInt32(12, 0, false);
          pcpView.setInt16(16, 0, false);
          pcpView.setInt16(18, 0xffff, false);
          // Start of IPv4 octets of the client's private IP
          var ipOctets = ipaddr.IPv4.parse(privateIp).octets;
          pcpView.setInt8(20, ipOctets[0]);
          pcpView.setInt8(21, ipOctets[1]);
          pcpView.setInt8(22, ipOctets[2]);
          pcpView.setInt8(23, ipOctets[3]);
          // Mapping Nonce (12 bytes)
          pcpView.setInt32(24, randInt(0, 0xffffffff), false);
          pcpView.setInt32(28, randInt(0, 0xffffffff), false);
          pcpView.setInt32(32, randInt(0, 0xffffffff), false);
          // Protocol (1 byte)
          pcpView.setInt8(36, 17);
          // Reserved (3 bytes)
          pcpView.setInt16(37, 0, false);
          pcpView.setInt8(39, 0);
          // Internal and external ports
          pcpView.setInt16(40, 55556, false);
          pcpView.setInt16(42, 55556, false);
          // External IP address (128 bytes; we use the all-zero IPv4 -> IPv6 mapping)
          pcpView.setFloat64(44, 0, false);
          pcpView.setInt16(52, 0, false);
          pcpView.setInt16(54, 0xffff, false);
          pcpView.setInt32(56, 0, false);

          socket.sendTo(pcpBuffer, routerIp, 5351);
        }).catch((err) => {
          R(new Error('Failed to bind to a port: ' + err.message));
        });
  });

  // Give _probePcpSupport 2 seconds before timing out
  return Promise.race([
    countdownFulfill(2000, false, () => { closeSocket(socket); }),
    _probePcpSupport
  ]);
}

// Send if UPnP AddPortMapping is supported by the router
// Returns a 'true' boolean if UPnP is supported
// Errors with a message if something breaks or times out (not supported)
export function probeUpnpSupport(privateIp:string) :Promise<boolean> {
  return new Promise((F, R) => {
    sendSsdpRequest(privateIp).
        then(fetchControlUrl).
        then((controlUrl:string) => sendAddPortMapping(controlUrl, privateIp)).
        then((result:boolean) => F(result)).
        catch((err:Error) => R(err));
  });
}

// Send a UPnP SSDP request to discover UPnP devices on the network
function sendSsdpRequest(privateIp:string) :Promise<ArrayBuffer> {
  var socket :freedom_UdpSocket.Socket;
  var _sendSsdpRequest = new Promise((F, R) => {
    socket = freedom['core.udpsocket']();

    // Fulfill when we get any reply (failure is on timeout or invalid parsing)
    socket.on('onData', (ssdpResponse:freedom_UdpSocket.RecvFromInfo) => {
      closeSocket(socket);
      F(ssdpResponse.data);
    });

    // Bind a socket and send the SSDP request
    socket.bind('0.0.0.0', 0).
        then(() => {
          // Construct and send a UPnP SSDP message
          var ssdpStr = 'M-SEARCH * HTTP/1.1\r\n' +
                        'HOST: 239.255.255.250:1900\r\n' +
                        'MAN: ssdp:discover\r\n' +
                        'MX: 10\r\n' +
                        'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1';
          var ssdpBuffer = arraybuffers.stringToArrayBuffer(ssdpStr);
          socket.sendTo(ssdpBuffer, '239.255.255.250', 1900);
        }).catch((err) => {
          R(new Error('Failed to bind to a port: ' + err.message));
        });
  });

  // Give _sendSsdpRequest 1 second before timing out
  return Promise.race([
    countdownReject(1000, '(SSDP timed out)', () => { closeSocket(socket); }),
    _sendSsdpRequest
  ]);
}

// Get the UPnP control URL from SSDP response
function fetchControlUrl(ssdpResponse:ArrayBuffer) :Promise<string> {
  var _fetchControlUrl = new Promise((F, R) => {
    // Get UPnP device profile URL from the LOCATION header
    var ssdpStr = arraybuffers.arrayBufferToString(ssdpResponse);
    var startIndex = ssdpStr.indexOf('LOCATION: ') + 10;
    var endIndex = ssdpStr.indexOf('\n', startIndex);
    var locationUrl = ssdpStr.substring(startIndex, endIndex);

    // Reject if there is no LOCATION header
    if (startIndex === -1) {
      R(new Error('(No LOCATION header for UPnP device)'));
    }

    // Get the XML device description at location URL
    var xhr = new XMLHttpRequest();
    xhr.open('GET', locationUrl, true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        // Get control URL from XML file
        // Ideally we would parse and traverse the XML tree for this,
        // but DOMParser is not available here
        var xmlDoc = xhr.responseText;
        var preIndex = xmlDoc.indexOf('WANIPConnection');
        var startIndex = xmlDoc.indexOf('<controlUrl>', preIndex) + 13;
        var endIndex = xmlDoc.indexOf('</controlUrl>', startIndex);

        // Reject if there is no controlUrl
        if (preIndex === -1 || startIndex === -1) {
          R(new Error('(Could not parse control URL)'));
        }

        // Combine the controlUrl path with the locationUrl
        var controlUrlPath = xmlDoc.substring(startIndex, endIndex);
        var locationUrlParser = new URL(locationUrl);
        var controlUrl = 'http://' + locationUrlParser.host +
                         '/' + controlUrlPath;

        F(controlUrl);
      }
    }
    xhr.send();
  });

  // Give _fetchControlUrl 1 second before timing out
  return Promise.race([
    countdownReject(1000, '(Timed out when retrieving description XML)'),
    _fetchControlUrl
  ]);
}

// Send a UPnP AddPortMapping request
function sendAddPortMapping(controlUrl:string, privateIp:string) :Promise<boolean> {
  var _sendAddPortMapping = new Promise((F, R) => {
    var internalPort = 55557;
    var externalPort = 55557;
    var leaseDuration = 120;  // Note: Some routers may not support a non-zero duration

    // Create the AddPortMapping SOAP request string
    var apm = '<?xml version="1.0"?>' +
              '<s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
               '<s:Body>' +
                  '<u:AddPortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1">' +
                     '<NewExternalPort>' + externalPort + '</NewExternalPort>' +
                     '<NewProtocol>UDP</NewProtocol>' +
                     '<NewInternalPort>' + internalPort + '</NewInternalPort>' +
                     '<NewInternalClient>' + privateIp + '</NewInternalClient>' +
                     '<NewEnabled>1</NewEnabled>' +
                     '<NewPortMappingDescription>uProxy UPnP probe</NewPortMappingDescription>' +
                     '<NewLeaseDuration>' + leaseDuration + '</NewLeaseDuration>' +
                  '</u:AddPortMapping>' +
                '</s:Body>' +
              '</s:Envelope>';

    // Create an XMLHttpRequest that encapsulates the SOAP string
    var xhr = new XMLHttpRequest();
    xhr.open('POST', controlUrl, true);
    xhr.setRequestHeader('Content-Type', 'text/xml');
    xhr.setRequestHeader('SOAPAction', '"urn:schemas-upnp-org:service:WANIPConnection:1#AddPortMapping"');

    // Send the AddPortMapping request
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) { F(true); }
    }
    xhr.send(apm);
  });

  // Give _sendAddPortMapping 1 second to run before timing out
  return Promise.race([
    countdownReject(1000, '(AddPortMapping timed out)'),
    _sendAddPortMapping
  ]);
}

// Returns a promise for the internal IP address of the computer
export function getInternalIp() :Promise<string> {
  var _getInternalIp = new Promise((F, R) => {
    var pc = freedom['core.rtcpeerconnection']({
      iceServers: globals.settings.stunServers
    });

    // One of the ICE candidates is the internal host IP; return it
    pc.on('onicecandidate',
      (candidate?:freedom_RTCPeerConnection.OnIceCandidateEvent) => {
      if (candidate.candidate) {
        var cand = candidate.candidate.candidate.split(' ');
        if (cand[7] === 'host') {
          var internalIp = cand[4];
          if (ipaddr.IPv4.isValid(internalIp)) {
            F(internalIp);
          }
        }
      }
    });

    // Set up the PeerConnection to start generating ICE candidates
    pc.createDataChannel('dummy data channel').
        then(pc.createOffer).
        then(pc.setLocalDescription);
  });

  // Give _getInternalIp 2 seconds to run before timing out
  return Promise.race([
    countdownReject(2000, 'getInternalIp() failed'),
    _getInternalIp
  ]);
}

// Generate a random integer between min and max
function randInt(min:number, max:number) :number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Return a promise that fulfills in a given time with a boolean
// Can run a callback function before fulfilling
function countdownFulfill(time:number, bool:boolean,
                          callback?:Function) :Promise<boolean> {
  return new Promise<boolean>((F, R) => {
    setTimeout(() => {
      if (callback !== undefined) { callback(); }
      F(bool);
    }, time);
  });
}

// Return a promise that rejects in a given time with an Error message
// Can call a callback function before rejecting
function countdownReject(time:number, msg:string,
                         callback?:Function) :Promise<any> {
  return new Promise<any>((F, R) => {
    setTimeout(() => {
      if (callback !== undefined) { callback(); }
      R(new Error(msg));
    }, time);
  });
}
