/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import turn_frontend = require('../turn-frontend/turn-frontend');
import messages = require('./messages');
import net = require('../net/net.types');

describe("turn frontend", function() {

  // Returns an array of 12 bytes, suuitable for use as a STUN/TURN
  // transaction ID.
  function getTransactionIdBytes() : Uint8Array {
    return new Uint8Array([
          0x2f, 0x68, 0x65, 0x79, 0x6b, 0x6b,
          0x31, 0x54, 0x46, 0x32, 0x36, 0x57]);
  }

  var frontend:turn_frontend.Frontend;
  var endpoint:net.Endpoint;

  beforeEach(function() {
    frontend = new turn_frontend.Frontend();
    endpoint = {
      address: '127.0.0.1',
      port: 10000
    };
  });

  // Unsupported requests should reject.
  it('reject unsupported request', (done) => {
    var request = {
      method: 999, // unsupported!
      clazz: messages.MessageClass.REQUEST,
      transactionId: getTransactionIdBytes(),
      attributes: <messages.StunAttribute[]>[]
    };
    frontend.handleStunMessage(request, endpoint).catch(done);
  });

  // Treat any ALLOCATE requests without a USERNAME attribute
  // as the "initial ALLOCATE request" which should return a
  // failure, with NONCE and REALM attributes.
  it('initial allocate request', (done) => {
    var request = {
      method: messages.MessageMethod.ALLOCATE,
      clazz: messages.MessageClass.REQUEST,
      transactionId: getTransactionIdBytes(),
      attributes: [{
        type: messages.MessageAttribute.REQUESTED_TRANSPORT
      }]
    };
    frontend.handleStunMessage(request, endpoint).then((response) => {
      expect(response.method).toEqual(messages.MessageMethod.ALLOCATE);
      expect(response.clazz).toEqual(messages.MessageClass.FAILURE_RESPONSE);
      // TODO: inspect these attributes
      messages.findFirstAttributeWithType(messages.MessageAttribute.ERROR_CODE, response.attributes);
      messages.findFirstAttributeWithType(messages.MessageAttribute.NONCE, response.attributes);
      messages.findFirstAttributeWithType(messages.MessageAttribute.REALM, response.attributes);
    }).then(done);
  });

  // TODO: test second allocate request (requires socket mocks)

  // TODO: test repeat ALLOCATE requests, verify just one allocation

  // TODO: test socket creation failure

  // TODO: test create permission returns success
});
