/**
 * uproxySpec.js
 *
 * There are a number of message types and interactions which prepare the
 * roster, clients, and instances. These have various caveats and edge cases,
 * and can also be received in different orders. This file lays out these
 * requirement and ensures consistency.
 */

var uproxy = this;        // Remember global uproxy context so spyOn works.
var state = store.state;  // Depends on state-storage.js.

describe("uproxy.updateUser", function() {

  // Stub out communications functions.
  beforeEach(function() {
    spyOn(uproxy, 'sendInstance');
  });

  it('does add user to roster.', function() {
    // Add a normal, non-UProxy client user.
    var normalAlice = {
      userId: 'alice@foo.bar',
      name: 'Alice No UProxy',
      clients: {
        'alice@foo.bar/normal12345': {
          clientId: 'alice@foo.bar/normal12345',
          network: 'magic',
          status: 'messageable'
        }
      }
    };
    var count = Object.keys(store.state.roster).length;
    var userId = normalAlice.userId;
    expect(state.roster[userId]).toBeUndefined();
    updateUser(normalAlice);
    expect(state.roster[userId]).toBeDefined();
    expect(Object.keys(state.roster).length).toBe(count + 1);
    expect(store.state.roster[userId]).toEqual({
      userId: 'alice@foo.bar',
      name: 'Alice No UProxy',
      clients: {
        'alice@foo.bar/normal12345': {
          clientId: 'alice@foo.bar/normal12345',
          network: 'magic',
          status: 'messageable'
        }
      },
      online: true,
      canUProxy: false,
      onGoogle: false,
      onFB: false,
      imageData: {},
      url: ''
    });
  });

  it('calls sendInstance for uproxy-enabled users', function() {
    // Add a user with an active 'uproxy' client, and ensure that we send her
    // our instance data.
    var wonderAlice = {
      userId: 'alice@censored.nationstate',
      name: 'Alice UProxy',
      clients: {
        'alice@foo.bar/uproxy1337': {
          clientId: 'alice@foo.bar/uproxy1337',
          network: 'magic',
          status: 'messageable'
        }
      }
    };
    updateUser(wonderAlice);
    var aliceClient = {
      clientId: 'alice@foo.bar/uproxy1337',
      network: 'magic',
      status: 'messageable'
    };
    expect(uproxy.sendInstance).toHaveBeenCalledWith(aliceClient.clientId);
  });
});  // uproxy.updateUser


var fakeInstanceSync = function(userId, clientId, data) {
  state.instances[data.instanceId] = {
    instanceId: data.instanceId,
    userId: userId,
    clientId: clientId,
  };
};

describe("uproxy.receiveInstance", function() {
  var instanceMsg = restrictToObject(DEFAULT_MESSAGE_ENVELOPE, {
    fromUserId: 'alice',
    fromClientId: 'alice-clientid',
    toUserId: '',
    data: restrictToObject(DEFAULT_INSTANCE_MESSAGE, {
      instanceId: '12345',
      rosterInfo: restrictToObject(DEFAULT_INSTANCE_MESSAGE_ROSTERINFO, {
        name: 'Alice Testuser',
        network: 'google'
      })
    }),
  });

  beforeEach(function() {
    spyOn(store, 'syncInstanceFromInstanceMessage')
        .andCallFake(fakeInstanceSync);
    spyOn(store, 'saveInstance');
    spyOn(uproxy, '_syncInstanceUI');
  });

  it('syncs and saves new instances.', function() {
    receiveInstance(instanceMsg);
    expect(store.syncInstanceFromInstanceMessage)
      .toHaveBeenCalledWith('alice', 'alice-clientid',
                            instanceMsg.data);
/*                            restrictToObject(DEFAULT_INSTANCE_MESSAGE, {
                              instanceId: '12345',
                              rosterInfo: restrictToObject(
                                  DEFAULT_INSTANCE_MESSAGE_ROSTERINFO, {

                            })); */
    var fakeInstance = state.instances['12345'];
    expect(store.saveInstance).toHaveBeenCalledWith('12345');
    expect(uproxy._syncInstanceUI).toHaveBeenCalledWith(fakeInstance);
  });

  it('sends consent message for a pre-existing instance', function() {
    spyOn(uproxy, 'sendConsent');
    receiveInstance(instanceMsg);
    var fakeInstance = state.instances['12345'];
    expect(uproxy.sendConsent).toHaveBeenCalledWith(fakeInstance);
  });
});


// Returns an object representing a single user instance.  Conforms to
// DEFAULT_ROSTER_ENTRY.
function makeUserRosterEntry(instanceId, userId) {
  var result = cloneDeep(DEFAULT_ROSTER_ENTRY);
  userId = userId + '@gmail.com';
  var clientId = userId + '/uproxy' + instanceId;
  result.userId = userId;
  result.clients = {};
  // validate for missing fields.
  result = restrictToObject(DEFAULT_ROSTER_ENTRY, result);
  result.clients[clientId] = restrictToObject(
      DEFAULT_ROSTER_CLIENT_ENTRY, {
        userId: userId,
        clientId: clientId,
        network: 'google',
        status: 'online',
        name: 'User' + userId,
      });
  return result;
}

// Returns an instance message from a roster entry.
// (DEFAULT_ROSTER_ENTRY ->
//        DEFAULT_MESSAGE_ENVELOPE{data=DEFAULT_INSTANCE_MESSAGE}).
// |userInstance| should be the result value from a call to
// makeUserRosterEntry(), a DEFAULT_ROSTER_ENTRY.
function makeInstanceMessage(userRosterEntry) {
  console.log('makeInstanceMessage(' + JSON.stringify(userRosterEntry) + ')');
  var result = cloneDeep(DEFAULT_MESSAGE_ENVELOPE);
  var client = userRosterEntry.clients[Object.keys(userRosterEntry.clients)[0]];
  result.fromUserId = userRosterEntry.userId;
  result.fromClientId = client.clientId;
  result.toUserId = 'you-should-not-be-checking-this';
  result = restrictToObject(DEFAULT_MESSAGE_ENVELOPE, result);

  var result_data = cloneDeep(DEFAULT_INSTANCE_MESSAGE);
  // pull the instanceID out of the clientID.
  var instanceId = client.clientId.substr(userRosterEntry.userId.length +
      '/uproxy'.length);
  result_data.instanceId = instanceId;
  result_data.description = 'description for user ' + userRosterEntry.userId;
  result_data.keyHash = 'HASHFORINSTANCE-' + instanceId;
  result_data = restrictToObject(DEFAULT_INSTANCE_MESSAGE, result_data);

  result_data.rosterInfo = restrictToObject(DEFAULT_INSTANCE_MESSAGE_ROSTERINFO, {
    name: userRosterEntry.name,
    network: client.network,
    userId: userRosterEntry.userId
  });
  result.data = result_data;
  return result;
}

// Validate the 'me' description in |self| against store.state.me.
function validateSelf(self) {
  expect(store.state.me.instanceId).toBeDefined();
  expect(store.state.me.keyHash).toBeDefined();
  expect(store.state.me.description).toBeDefined();
  // These should be properly generated, not the fake ones we entered
  // in originally.
  expect(store.state.me.instanceId).not.toBe(self.instanceId);
  expect(store.state.me.keyHash).not.toBe(self.keyHash);
  expect(store.state.me.description).not.toBe(self.description);
}

// Validate that |inst| is present and proper inside
// store.state. |inst| should be the return value from a call to
// makeInstanceMessage().
function validateInstance(inst) {
  // 1. Validate instances[] has this instance, that the data is
  //    correct, and that it's well-formed.
  // 2. Validate clientToInstance[] has this instance, and it's
  //    properly mapped.
  // 3. Validate instanceToClient[] has this instance, and that it's
  //    properly mapped.

  // Validate instances.
  expect(store.state.instances).toBeDefined();
  expect(store.state.instances[inst.instanceId]).toBeDefined();
  expect(store.state.instances[inst.instanceId].instanceId).toBe(
      inst.instanceId);
  expect(store.state.instances[inst.instanceId].userID).toBe(inst.userId);
  expect(store.state.instances[inst.instanceId].network).toBe(inst.network);
  expect(store.state.instances[inst.instanceId].url).toBe(inst.url);
  expect(store.state.instances[inst.instanceId].description).toBe(
      inst.description);
  expect(store.state.instances[inst.instanceId].keyHash).toBe(inst.keyHash);
  expect(store.state.instances[inst.instanceId].trust).toBeDefined();
  expect(store.state.instances[inst.instanceId].trust.asProxy).toBe(Trust.NO);
  expect(store.state.instances[inst.instanceId].trust.asClient).toBe(Trust.NO);
  expect(store.state.instances[inst.instanceId].status).toBeDefined();
  expect(store.state.instances[inst.instanceId].status.proxy).toBe(
      DEFAULT_PROXY_STATUS.proxy);
  expect(store.state.instances[inst.instanceId].status.client).toBe(
      DEFAULT_PROXY_STATUS.client);

  // Validate clientToInstance[] mapping.
  expect(store.state.clientToInstance).toBeDefined();
  expect(Object.keys(store.state.clientToInstance).filter(function(client) {
    return store.state.clientToInstance[client] == inst.instanceId;
  }).length).toBe(1);

  // Validate instanceToClient[] mapping.
  expect(store.state.instanceToClient).toBeDefined();
  expect(store.state.instanceToClient[inst.instanceId]).toBeDefined();
  // We don't have .in(), so reverse args and use .toContain()
  expect(Object.keys(store.state.roster[inst.rosterInfo.userId].clients)).toContain(
      store.state.instanceToClient[inst.instanceId]);
}

describe("uproxy.state.instance", function () {
  // Try variants of [local state loading, network login,
  // instance ID reception].  Validate resulting state.

  // conforms both to DEFAULT_STATUS and DEFAULT_INSTANCE.
  var selfInstanceAndStatusMessage = {
    userId: 'self@selfmail.com',
    name: 'My self.',
    network: 'google',
    message: 'Woo!',
    status: 'online',
    description: 'my self in a test instance.',
    instanceId: '0000000001',
    keyHash: 'HASHFORINSTANCE-0000000001',
    clients: {
      'self@selfmail.com/uproxy00001': {
        clientId: 'self@selfmail.com/uproxy00001',
        network: 'testonly',
        status: 'messageable'
      }
    }
  };

  var userRoster = [
    makeUserRosterEntry('2222222222', 'secondUser'),
    makeUserRosterEntry('3333333333', 'thirdUser'),
    makeUserRosterEntry('4444444444', 'fourthUser'),
    makeUserRosterEntry('5555555555', 'fifthUser'),
    makeUserRosterEntry('6666666666', 'sixthUser')
  ];

  var sendMessageSpy;

  beforeEach(function () {
    // Stub out extension-related communications.  This may not be
    // necessary with freedom already stubbed out.
    spyOn(uproxy, 'sendInstance');
    spyOn(uproxy, '_SyncUI');
    // identity's a MockChannel.  Add some spies for identity-specific APIs an
    // top of on() and emit().
    sendMessageSpy = jasmine.createSpy('sendMessage');
    identity.sendMessage = sendMessageSpy;
    var completed = false;
    store.reset(function() {completed = true; });
    waitsFor(function() { return completed; }, "Reset never returned.", 50);
  });

  it('onState-Roster-Instance', function() {
    // This should be the simplest way in.  You get a login for yourself, then
    // a roster, then instance notifications.
    var inst;
    // receiveStatus expects a DEFAULT_STATUS message.
    receiveStatus(selfInstanceAndStatusMessage);

    // receiveChange expects a DEFAULT_INSTANCE message.
    receiveChange(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      receiveChange(userRoster[inst]);
    }

    // We have to wrap up the instance data in a DEFAULT_INSTANCE_MESSAGE
    // message.  receiveInstance expects a DEFAULT_INSTANCE_MESSAGE.
    for (inst in userRoster) {
      receiveInstance(makeInstanceMessage(userRoster[inst]));
    }

    // Now check our state.
    validateSelf(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      validateInstance(makeInstanceMessage(userRoster[inst]).data);
    }
  });

  // Like above, only we get all the instance messages first.
  it('onState-Instance-Roster-Bulk', function() {
    // This should be the simplest way in.  You get a login for yourself, then
    // a roster, then instance notifications.
    var inst;
    // receiveStatus expects a DEFAULT_STATUS message.
    receiveStatus(selfInstanceAndStatusMessage);

    // We have to wrap up the instance data in a DEFAULT_INSTANCE_MESSAGE
    // message.
    for (inst in userRoster) {
      receiveInstance(makeInstanceMessage(userRoster[inst]));
    }

    // receiveChange expects a DEFAULT_INSTANCE message.
    receiveChange(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      receiveChange(userRoster[inst]);
    }

    // Now check our state.
    validateSelf(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      validateInstance(makeInstanceMessage(userRoster[inst]).data);
    }
  });

  // We get each instance message before each roster update.
  it('onState-Instance-Roster-Incremental', function() {
    // This should be the simplest way in.  You get a login for yourself, then
    // a roster, then instance notifications.
    var inst;
    // receiveStatus expects a DEFAULT_STATUS message.
    receiveStatus(selfInstanceAndStatusMessage);
    receiveChange(selfInstanceAndStatusMessage);

    // We have to wrap up the instance data in a DEFAULT_INSTANCE_MESSAGE
    // message.  receiveChange expects a DEFAULT_INSTANCE
    // message. receiveInstance expects a DEFAULT_INSTANCE_MESSAGE.
    for (inst in userRoster) {
      receiveInstance(makeInstanceMessage(userRoster[inst]));
      receiveChange(userRoster[inst]);
    }

    // Now check our state.
    validateSelf(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      validateInstance(makeInstanceMessage(userRoster[inst]).data);
    }
  });});

describe("uproxy.state.instance.fuzzer", function () {
  // Feed in randomized ordering of data, some of it bad, and make
  // sure internal validation can survive.
});
