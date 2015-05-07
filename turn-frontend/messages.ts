/// <reference path='../../../third_party/sha1/sha1.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');

import net = require('../net/net.types');

import sha1 = require('crypto/sha1');

/**
 * Utilities for decoding and encoding STUN messages.
 * TURN uses STUN messages, adding some methods and attributes.
 *
 * http://tools.ietf.org/html/rfc5389#section-6
 */

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
    clazz : clazz,
    method : method,
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
export function formatStunMessageWithIntegrity(message:StunMessage) : Uint8Array {
  // Append the attribute and obtain the bytes...
  message.attributes.push({
    type: MessageAttribute.MESSAGE_INTEGRITY,
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
    attr:StunAttribute,
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
export function parseStunAttribute(bytes:Uint8Array) : StunAttribute {
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
export function parseMappedAddressAttribute(bytes:Uint8Array) : net.Endpoint {
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
export function parseXorMappedAddressAttribute(bytes:Uint8Array) : net.Endpoint {
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
  type:MessageAttribute,
  attributes:StunAttribute[]) : StunAttribute {
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
