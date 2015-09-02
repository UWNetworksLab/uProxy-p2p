/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import net = require('../net/net.types');
import messages = require('../turn-frontend/messages');

describe("stun messages", function() {

  function getTransactionIdBytes() : Uint8Array {
    return new Uint8Array([
          0x2f, 0x68, 0x65, 0x79, 0x6b, 0x6b,
          0x31, 0x54, 0x46, 0x32, 0x36, 0x57]);
  }

  /** Returns the "magic cookie" bytes. */
  function getMagicCookieBytes() : Uint8Array {
    return new Uint8Array([0x21, 0x12, 0xa4, 0x42]);
  }

  /**
   * Returns the bytes of a simple valid STUN message.
   * The message has the SUCCESS_RESPONSE (C1 bit) class and
   * has the CHANNEL_BIND method.
   */
  function getSimpleStunMessageBytes() : Uint8Array {
    var bytes = new Uint8Array(20);
    bytes[0] = 0x01; // type (method + class)
    bytes[1] = 0x09;
    bytes[2] = 0; // length
    bytes[3] = 0;
    bytes.set(getMagicCookieBytes(), 4);
    bytes.set(getTransactionIdBytes(), 8);
    return bytes;
  };

  /** As #getSimpleStunMessageBytes but the message has two attributes. */
  function getStunMessageWithAttributesBytes() : Uint8Array {
    var attrBytes = new Uint8Array([
      // First attribute.
      1200 >> 8, 1200 & 0xFF, // type 1200
      0, 2, // length
      0x55, 0x56, 0, 0, // value (and 32-bit boundary padding)
      // Second attribute.
      1000 >> 8, 1000 & 0xFF, // type 1000
      0, 4, // length
      0x55, 0x56, 0x57, 0x58]); // value

    var simpleBytes = getSimpleStunMessageBytes();
    var bigBuff = new ArrayBuffer(simpleBytes.length + attrBytes.length);
    var bigBytes = new Uint8Array(bigBuff);
    bigBytes.set(simpleBytes);
    bigBytes.set(attrBytes, simpleBytes.length);
    bigBytes[3] = attrBytes.length; // message length.

    return bigBytes;
  }

  /** Returns the message encoded by #getSimpleStunMessageBytes. */
  function getSimpleStunMessage() : messages.StunMessage {
    return {
      method: messages.MessageMethod.CHANNEL_BIND,
      clazz: messages.MessageClass.SUCCESS_RESPONSE,
      transactionId: getTransactionIdBytes(),
      attributes: []
    };
  }

  /** Returns the message encoded by #getStunMessageWithAttributesBytes. */
  function getStunMessageWithAttributes() : messages.StunMessage {
    var message = getSimpleStunMessage();
    message.attributes = [{
        type: 1200,
        value: new Uint8Array([0x55, 0x56])
      }, {
        type: 1000,
        value: new Uint8Array([0x55, 0x56, 0x57, 0x58])
      }];
    return message;
  }

  /** Returns the bytes of a MAPPED-ADDRESS attribute. */
  function getMappedAddressAttributeBytes() : Uint8Array {
    return new Uint8Array([
        0x00, // reserved
        0x01, // address family (IPv4)
        32000 >> 8, // msb of port
        32000 & 0xff, // lsb of port
        192, 168, 1, 1]); // address
  }

  /** XOR-MAPPED-ADDRESS equivalent of #getMappedAddressAttributeBytes. */
  function getXorMappedAddressAttributeBytes() : Uint8Array {
    var bytes = getMappedAddressAttributeBytes();
    var magicCookieBytes = getMagicCookieBytes();
    bytes[2] ^= magicCookieBytes[0]; // msb of port
    bytes[3] ^= magicCookieBytes[1]; // lsb of port
    for (var i = 0; i < 4; i++) {
      bytes[4 + i] ^= magicCookieBytes[i];
    }
    return bytes;
  }

  /**
   * Returns the endpoint encoded by #getMappedAddressAttributeBytes
   * and #getXorMappedAddressAttributeBytes. */
  function getEndpoint() : net.Endpoint {
    return {
      address: '192.168.1.1',
      port: 32000
    };
  }

  it('reject short messages', function() {
    expect(function() {
      messages.parseStunMessage(new Uint8Array(new ArrayBuffer(5)));
    }).toThrow();
  });

 it('reject non-zero first two bits', function() {
    var bytes = getSimpleStunMessageBytes();
    bytes[0] = 0xd0;
    expect(function() {
      messages.parseStunMessage(bytes);
    }).toThrow();
  });

  it('parse simple message', function() {
    var bytes = getSimpleStunMessageBytes();
    var req = messages.parseStunMessage(bytes);
    expect(req.clazz).toEqual(messages.MessageClass.SUCCESS_RESPONSE);
    expect(req.method).toEqual(messages.MessageMethod.CHANNEL_BIND);
    expect(compareUint8Array(req.transactionId,
        getTransactionIdBytes())).toBe(true);
    expect(req.attributes.length).toEqual(0);
  });

  it('format simple message', function() {
    var message = getSimpleStunMessage();
    var bytes = messages.formatStunMessage(message);
    var expectedBytes = getSimpleStunMessageBytes();
    expect(compareUint8Array(expectedBytes, bytes)).toBe(true);
  });

  it('method bit operations', function() {
    // Set the first two bytes to read:
    //   0011 0011 1101 1101
    // Masking out the leading two bits and C1 and C0 leaves:
    //   xx11 001x 110x 1101 -> 1100 1110 1101 (0xced)
    var bytes = getSimpleStunMessageBytes();
    bytes[0] = 0x33;
    bytes[1] = 0xdd;
    var req = messages.parseStunMessage(bytes);
    expect(req.clazz).toEqual(messages.MessageClass.FAILURE_RESPONSE);
    expect(req.method).toEqual(0xced);
  });

  /**
   * Sets one of the magic cookie bytes to the wrong value and verifies
   * that an exception is raised.
   */
  it('parse simple attribute', function() {
    var bytes = getSimpleStunMessageBytes();
    bytes[6] = 0xFF;
    expect(function() {
      messages.parseStunMessage(bytes);
    }).toThrow();
  });

  it('reject short attributes', function() {
    expect(function() {
      messages.parseStunAttribute(new Uint8Array(new ArrayBuffer(3)));
    }).toThrow();
  });

  it('parse simple attribute', function() {
    var bytes = new Uint8Array([
      1200 >> 8, 1200 & 0xFF, // type
      0, 2, // length
      0x55, 0x56]); // value

    var attr = messages.parseStunAttribute(bytes);
    expect(attr.type).toEqual(1200);
    expect(attr.value.length).toEqual(2);
    expect(attr.value[0]).toEqual(0x55);
    expect(attr.value[1]).toEqual(0x56);
  });

  it('format simple attribute', function() {
    var attr = {
      type: 1200,
      value: new Uint8Array([0x55, 0x56])
    };
    var bytes = new Uint8Array(8);
    messages.formatStunAttribute(attr, bytes);
    var expectedBytes = new Uint8Array([
      1200 >> 8, 1200 & 0xFF, // type
      0, 2, // length
      0x55, 0x56, 0, 0]); // value and padding
    expect(compareUint8Array(expectedBytes, bytes)).toBe(true);
  });

  it('parse zero-length attribute', function() {
    var bytes = new Uint8Array([
      0, 0, // type
      0, 0]); // length

    var attr = messages.parseStunAttribute(bytes);
    expect(attr.value).toBeUndefined();
  });

  it('format zero-length attribute', function() {
    var attr = {
      type: 1
    };
    var bytes = new Uint8Array(4);
    messages.formatStunAttribute(attr, bytes);
    var expectedBytes = new Uint8Array([
      0, 1, // type
      0, 0]); // length
    expect(compareUint8Array(expectedBytes, bytes)).toBe(true);
  });

  it('format attribute with too few bytes', function() {
    var attr = {
      type: 1
    };
    var bytes = new Uint8Array(3);
    expect(function() {
      messages.formatStunAttribute(attr, bytes);
    }).toThrow();
  });

  it('parse message with attributes', function() {
    var bytes = getStunMessageWithAttributesBytes();
    var req = messages.parseStunMessage(bytes);
    expect(req.attributes.length).toEqual(2);
    var attr1 = req.attributes[0];
    expect(attr1.type).toEqual(1200);
    var expectedBytes = new Uint8Array([0x55, 0x56]);
    expect(compareUint8Array(expectedBytes, attr1.value)).toBe(true);
    var attr2 = req.attributes[1];
    expect(attr2.type).toEqual(1000);
    var expectedBytes = new Uint8Array([0x55, 0x56, 0x57, 0x58]);
    expect(compareUint8Array(expectedBytes, attr2.value)).toBe(true);
  });

  it('format message with attributes', function() {
    var message = getStunMessageWithAttributes();
    var bytes = messages.formatStunMessage(message);
    var expectedBytes = getStunMessageWithAttributesBytes();
    expect(compareUint8Array(expectedBytes, bytes)).toBe(true);
  });

  it('calculate padding', function() {
    expect(messages.calculatePadding(0, 4)).toEqual(0);
    expect(messages.calculatePadding(1, 4)).toEqual(4);
    expect(messages.calculatePadding(4, 4)).toEqual(4);
    expect(messages.calculatePadding(7, 4)).toEqual(8);
  });

  it('format error-code attribute', function() {
    var bytes = messages.formatErrorCodeAttribute(399, 'test');
    var expectedBytes = new Uint8Array([
          0x00, // reserved
          0x00, // reserved
          0x03, // reserved + class
          99,   // number
          't'.charCodeAt(0),
          'e'.charCodeAt(0),
          's'.charCodeAt(0),
          't'.charCodeAt(0)]);
    expect(compareUint8Array(expectedBytes, bytes)).toBe(true);
  });

  it('find stun attributes', function() {
    var message = getStunMessageWithAttributes();

    // The first attribute is type 1200 and has two bytes worth of data.
    var attribute = messages.findFirstAttributeWithType(1200, message.attributes);
    expect(attribute).toBeDefined();
    expect(attribute.value.byteLength).toEqual(2);

    // The second attribute is type 1000 and has four bytes worth of data.
    attribute = messages.findFirstAttributeWithType(1000, message.attributes);
    expect(attribute).toBeDefined();
    expect(attribute.value.byteLength).toEqual(4);

    // This should not be found.
    expect(function() {
      messages.findFirstAttributeWithType(500, message.attributes);
    }).toThrow();
  });

  it('format bad MAPPED-ADDRESS attribute', function() {
    expect(function() {
      messages.formatMappedAddressAttribute('nonsense.xxx', 7);
    }).toThrow();
  });

  it('format MAPPED-ADDRESS attribute', function() {
    var bytes = messages.formatMappedAddressAttribute('192.168.1.1', 32000);
    var expectedBytes = getMappedAddressAttributeBytes();
    expect(compareUint8Array(expectedBytes, bytes)).toBe(true);
  });

  it('format XOR-MAPPED-ADDRESS attribute', function() {
    var bytes = messages.formatXorMappedAddressAttribute('192.168.1.1', 32000);
    var expectedBytes = getXorMappedAddressAttributeBytes();
    expect(compareUint8Array(expectedBytes, bytes)).toBe(true);
  });

  it('parse MAPPED-ADDRESS attribute', function() {
    var bytes = getMappedAddressAttributeBytes();
    var attribute = messages.parseMappedAddressAttribute(bytes);
    expect(attribute).toEqual(getEndpoint());
  });

  it('parse XOR-MAPPED-ADDRESS attribute', function() {
    var bytes = getXorMappedAddressAttributeBytes();
    var attribute = messages.parseXorMappedAddressAttribute(bytes);
    expect(attribute).toEqual(getEndpoint());
  });

  it('compute hash', function() {
    // This is the bytes comprising the following StunMessage, wireshark-ed
    // from a session between Chrome and rfc5766-turn-server:
    // {
    //   method: ALLOCATE
    //   clazz: SUCCESS_RESPONSE
    //   transactionId: 4f:49:62:31:57:4c:58:67:39:74:4c:4a
    //   attributes: {
    //     XOR-RELAYED-ADDRESS: 127.0.0.1:64226
    //     XOR-MAPPED-ADDRESS: 172.26.76.61:48328
    //     LIFETIME: 600
    //     SOFTWARE: Citrix-3.2.3.5 'Marshal West'
    //     MESSAGE-INTEGRITY: c7:28:13:13:33:68:fc:5b:8c:ae:fc:da:94:aa:99:45:6a:8f:2b:74
    //   }
    // }
    var dataBytes = new Uint8Array([
      0x01, 0x03, 0x00, 0x5c, 0x21, 0x12, 0xa4, 0x42,
      0x4f, 0x49, 0x62, 0x31, 0x57, 0x4c, 0x58, 0x67,
      0x39, 0x74, 0x4c, 0x4a, 0x00, 0x16, 0x00, 0x08,
      0x00, 0x01, 0xdb, 0xf0, 0x5e, 0x12, 0xa4, 0x43,
      0x00, 0x20, 0x00, 0x08, 0x00, 0x01, 0x9d, 0xda,
      0x8d, 0x08, 0xe8, 0x7f, 0x00, 0x0d, 0x00, 0x04,
      0x00, 0x00, 0x02, 0x58, 0x80, 0x22, 0x00, 0x1d,
      0x43, 0x69, 0x74, 0x72, 0x69, 0x78, 0x2d, 0x33,
      0x2e, 0x32, 0x2e, 0x33, 0x2e, 0x35, 0x20, 0x27,
      0x4d, 0x61, 0x72, 0x73, 0x68, 0x61, 0x6c, 0x20,
      0x57, 0x65, 0x73, 0x74, 0x27, 0x32, 0x2e, 0x33,
      // MESSAGE-INTEGRITY starts here.
      0x00, 0x08, 0x00, 0x14, 0xc7, 0x28, 0x13, 0x13,
      0x33, 0x68, 0xfc, 0x5b, 0x8c, 0xae, 0xfc, 0xda,
      0x94, 0xaa, 0x99, 0x45, 0x6a, 0x8f, 0x2b, 0x74]);

    var expectedHashBytes = new Uint8Array([
      0xc7, 0x28, 0x13, 0x13,
      0x33, 0x68, 0xfc, 0x5b,
      0x8c, 0xae, 0xfc, 0xda,
      0x94, 0xaa, 0x99, 0x45,
      0x6a, 0x8f, 0x2b, 0x74]);
    var hashBytes = messages.computeHash(dataBytes);
    expect(compareUint8Array(expectedHashBytes, hashBytes)).toBe(true);
  });

  // Bah, toEqual() doesn't work for Uint8Array.
  function compareUint8Array(a1:Uint8Array, a2:Uint8Array) {
    if (a1.length != a2.length) {
      return false;
    }
    for (var i = 0; i < a1.length; i++) {
      if (a1[i] != a2[i]) {
        return false;
      }
    }
    return true;
  }
});
