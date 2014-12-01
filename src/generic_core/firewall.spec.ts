/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='firewall.ts' />
class MockPolicy implements Firewall.ResponsePolicy {
  failures : number = 0;
  onValidationFailure(s :string, level :Firewall.Severity) {
    this.failures++;
  }
};

describe('Firewall.SocialUserProfile', () => {
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
    // Failed regex on a string field
    {
      'userId' : 'alice',
      'timestamp' : 7
    },
    // Failed numerical value on a number field.
    {
      'userId' : 'alice@gmail.com',
      'timestamp' : -1
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
    expect(Firewall.IsValidUserProfile( 
        <freedom_Social.UserProfile> goodUserProfile, policy)).toBe(true);
  });

  it('rejects structurally-different profiles', () => {
    for (var i in schemaFailingUserProfiles) {
      expect(Firewall.IsValidUserProfile( 
          <freedom_Social.UserProfile> schemaFailingUserProfiles[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(schemaFailingUserProfiles.length);
  });

  it('rejects profiles with bad values', () => {
    for (var i in valueFailingUserProfiles) {
      expect(Firewall.IsValidUserProfile( 
          <freedom_Social.UserProfile> valueFailingUserProfiles[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(valueFailingUserProfiles.length);
  });
});

describe('Firewall.SocialClientState', () => {
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
    // Failed regex on a string field
    {
      'userId' : 'alice',
      'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      'status' : 'Happy',
      'timestamp' : 30,
      'lastSeen' : 100,
    },
    // Failed numerical value on a number field.
    {
      'userId' : 'alice@gmail.com',
      'clientId' : 'alice@gmail.com/Android-19078634adfkj',
      'status' : 'Happy',
      'timestamp' : -1,
      'lastSeen' : 100,
    }]

  var goodClientState = {
    'userId' : 'alice@gmail.com',
    'clientId' : 'alice@gmail.com/Android-23nadsv32f',
    'status' : 'Happy',
    'timestamp' : 30
  };

  var policy : MockPolicy;

  beforeEach(() => {
    policy = new MockPolicy();
  });

  it('accepts good client states', () => {
    expect(Firewall.IsValidClientState( 
        <freedom_Social.ClientState> goodClientState, policy)).toBe(true);
  });

  it('rejects structurally-different client states', () => {
    for (var i in schemaFailingClientStates) {
      expect(Firewall.IsValidClientState( 
          <freedom_Social.ClientState> schemaFailingClientStates[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(schemaFailingClientStates.length);
  });

  it('rejects client states with bad values', () => {
    for (var i in valueFailingClientStates) {
      expect(Firewall.IsValidClientState( 
          <freedom_Social.ClientState> valueFailingClientStates[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(valueFailingClientStates.length);
  });
});  

describe('Firewall.SocialIncomingMessage', () => {
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
    // Failed regex on a string field
    {
      'from' : {
        'userId' : 'alice',
        'clientId' : 'alice@gmail.com/Android-19078634adfkj',
        'status' : 'Happy',
        'timestamp' : 30,
      },
      'message' : ''
    },
    // Failed numerical value on a number field.
    {
      'from' : {
        'userId' : 'alice@gmail.com',
        'clientId' : 'alice@gmail.com/Android-19078634adfkj',
        'status' : 'Happy',
        'timestamp' : -1,
      },
      'message' : ''
    }]

  var goodIncomingMessage = {
    'from' : {
      'userId' : 'alice@gmail.com',
      'clientId' : 'alice@gmail.com/Android-23nadsv32f',
      'status' : 'Happy',
      'timestamp' : 30,
    },
    'message' : 'hello!'
  };

  var policy : MockPolicy;

  beforeEach(() => {
    policy = new MockPolicy();
  });

  it('accepts good incoming messages', () => {
    expect(Firewall.IsValidIncomingMessage( 
        <freedom_Social.IncomingMessage> goodIncomingMessage, policy)).toBe(true);
  });

  it('rejects structurally-different incoming messages', () => {
    for (var i in schemaFailingIncomingMessages) {
      expect(Firewall.IsValidIncomingMessage( 
          <freedom_Social.IncomingMessage> schemaFailingIncomingMessages[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(schemaFailingIncomingMessages.length);
  });

  it('rejects incoming messages with bad values', () => {
    for (var i in valueFailingIncomingMessages) {
      expect(Firewall.IsValidIncomingMessage( 
          <freedom_Social.IncomingMessage> valueFailingIncomingMessages[i],
        policy)).toBe(false);
    }
    expect(policy.failures).toBe(valueFailingIncomingMessages.length);
  });
});  

    