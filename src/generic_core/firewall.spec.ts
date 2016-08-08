/// <reference path='../../../third_party/typings/index.d.ts' />

import freedomMocker = require('../lib/freedom/mocks/mock-freedom-in-module-env');
import mockFreedomRtcPeerConnection = require('../lib/freedom/mocks/mock-rtcpeerconnection');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'loggingcontroller': () => { return new freedom_mocks.MockLoggingController(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'core.tcpsocket': () => { return new freedom_mocks.MockTcpSocket(); },
  'core.rtcpeerconnection': () => { return new mockFreedomRtcPeerConnection(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import freedom_mocks = require('../mocks/freedom-mocks');
import firewall = require('./firewall');

class MockPolicy implements firewall.ResponsePolicy {
  failures : number = 0;
  onValidationFailure(s :string, level :firewall.Severity) {
    this.failures++;
  }
};

describe('firewall.SocialUserProfile', () => {
  // First, exercise the schema validations
  var schemaFailingUserProfiles = [
    // No required fields.
    {},
    // Required fields, but wrong type of one of them.
    {
      'userId' : 6,
      'timestamp' : '19078634adfkj',
    },
    // Good required fields, but wrong type of an optional field.
    {
      'userId' : 'alice@gmail.com',
      'timestamp' : 6,
      'name' : 7,
    },
    // Good required fields, but extra unwanted field
    {
      'userId' : 'alice@gmail.com',
      'timestamp' : 300,
      'fooBar' : 6
    }
  ];

  var valueFailingUserProfiles = [
    // Failed for reserved word on a string field
    {
      'userId' : '__proto__',
      'timestamp' : 7,
      'name': 'John Doe',
    },
    // Failed numerical value on a number field.
    {
      'userId' : 'alice@gmail.com',
      'timestamp' : -1,
      'name': 'John Doe',
    }]

  var goodUserProfile = {
      'userId' : 'alice@gmail.com',
      'timestamp' : 100,
      'name' : 'alice smith',
      'url' : 'http://alice.smith.name',
      'imageData' : '__ image __'
    };

  var policy : MockPolicy;

  beforeEach(() => {
    policy = new MockPolicy();
  });

  it('accepts good profiles', () => {
    expect(firewall.isValidUserProfile(
        <freedom.Social.UserProfile> goodUserProfile, policy)).toBe(true);
  });

  it('rejects structurally-different profiles', () => {
    for (var i in schemaFailingUserProfiles) {
      expect(firewall.isValidUserProfile(
          <freedom.Social.UserProfile> schemaFailingUserProfiles[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(schemaFailingUserProfiles.length);
  });

  it('rejects profiles with bad values', () => {
    for (var i in valueFailingUserProfiles) {
      expect(firewall.isValidUserProfile(
          <freedom.Social.UserProfile> valueFailingUserProfiles[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(valueFailingUserProfiles.length);
  });
});

describe('firewall.SocialClientState', () => {
  // First, exercise the schema validations
  var schemaFailingClientStates = [
    // No required fields.
    {},
    // Required fields, but wrong type of one of them.
    {
      'userId' : 6,
      'clientId' : 'alice@gmail.com/Android-19078634adfkj',
    },
    // Good required fields, but wrong type of an optional field.
    {
      'userId' : 'alice@gmail.com',
      'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      'status' : 6
    },
    // Good required fields, but extra unwanted field
    {
      'userId' : 'alice@gmail.com',
      'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      'fooBar' : 6
    },
  ];

  var valueFailingClientStates = [
    // Failed reserved word on a string field
    {
      'userId' : '__proto__',
      'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      'status' : 'ONLINE',
      'timestamp' : 30,
      'lastSeen' : 100,
    },
    // Failed numerical value on a number field.
    {
      'userId' : 'alice@gmail.com',
      'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      'status' : 'ONLINE',
      'timestamp' : -1,
      'lastSeen' : 100,
    }]

  var goodClientState = {
    'userId' : 'alice@gmail.com',
    'clientId' : 'alice@gmail.com/Android-23nadsv32f',
    'status' : 'ONLINE',
    'timestamp' : 30
  };

  var policy : MockPolicy;

  beforeEach(() => {
    policy = new MockPolicy();
  });

  it('accepts good client states', () => {
    expect(firewall.isValidClientState(
        <freedom.Social.ClientState> goodClientState, policy)).toBe(true);
  });

  it('rejects structurally-different client states', () => {
    for (var i in schemaFailingClientStates) {
      expect(firewall.isValidClientState(
          <freedom.Social.ClientState> schemaFailingClientStates[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(schemaFailingClientStates.length);
  });

  it('rejects client states with bad values', () => {
    for (var i in valueFailingClientStates) {
      expect(firewall.isValidClientState(
          <freedom.Social.ClientState> valueFailingClientStates[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(valueFailingClientStates.length);
  });
});

describe('firewall.SocialIncomingMessage', () => {
  // First, exercise the schema validations
  var schemaFailingIncomingMessages = [
    // No required fields.
    {},
    // Required fields, but wrong type of one of them.
    {
      'from' : {
        'userId' : 6,
        'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      },
      'message' : 'foo'
    },
    // Good required fields, but wrong type of an optional field.
    {
      'from' : {
        'userId' : 'alice@gmail.com',
        'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      },
      'message' : 6
    },
    // Good required fields, but extra unwanted field
    {
      'from' : {
        'userId' : 'alice@gmail.com',
        'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      },
      'message' : 'foo',
      'fooBar' : 6
    },
  ];

  var valueFailingIncomingMessages = [
    // Failed reserved word on a string field
    {
      'from' : {
        'userId' : '__proto__',
        'clientId' : 'alice@gmail.com/Android-19078634adfkj',
        'status' : 'ONLINE',
        'timestamp' : 30,
      },
      'message' : ''
    },
    // Failed numerical value on a number field.
    {
      'from' : {
        'userId' : 'alice@gmail.com',
        'clientId' : 'alice@gmail.com/Android-19078634adfkj',
        'status' : 'ONLINE',
        'timestamp' : -1,
      },
      'message' : ''
    }]

  var goodIncomingMessage = {
    'from' : {
      'userId' : 'alice@gmail.com',
      'clientId' : 'alice@gmail.com/Android-23nadsv32f',
      'status' : 'ONLINE',
      'timestamp' : 30,
    },
    'message' : 'hello!'
  };

  var policy : MockPolicy;

  beforeEach(() => {
    policy = new MockPolicy();
  });

  it('accepts good incoming messages', () => {
    expect(firewall.isValidIncomingMessage(
        <freedom.Social.IncomingMessage> goodIncomingMessage, policy)).toBe(true);
  });

  it('rejects structurally-different incoming messages', () => {
    for (var i in schemaFailingIncomingMessages) {
      expect(firewall.isValidIncomingMessage(
          <freedom.Social.IncomingMessage> schemaFailingIncomingMessages[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(schemaFailingIncomingMessages.length);
  });

  it('rejects incoming messages with bad values', () => {
    for (var i in valueFailingIncomingMessages) {
      expect(firewall.isValidIncomingMessage(
          <freedom.Social.IncomingMessage> valueFailingIncomingMessages[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(valueFailingIncomingMessages.length);
  });
});


