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
    debugger;
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
  var instanceMsg = {
    fromUserId: 'alice',
    fromClientId: 'alice-clientid',
    data: {
      instanceId: '12345'
    }
  };

  beforeEach(function() {
    spyOn(store, 'syncInstanceFromInstanceMessage')
        .andCallFake(fakeInstanceSync);
    spyOn(store, 'saveInstance');
    spyOn(uproxy, '_syncInstanceUI');
  });

  it('syncs and saves new instances.', function() {
    receiveInstance(instanceMsg);
    expect(store.syncInstanceFromInstanceMessage)
      .toHaveBeenCalledWith('alice', 'alice-clientid', {
        instanceId: '12345'
      });
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


// Returns an object representing a single user instance.
function makeUserInstance(instanceId, userId) {
  var result = cloneDeep(DEFAULT_INSTANCE);
  userId = userId + '@gmail.com';
  result.instanceId = instanceId;
  result.keyHash = 'HASHFORINSTANCE-' + instanceId;
  result.rosterInfo.userId = userId;
  result.rosterInfo.name = 'User ' + userId;
  result.rosterInfo.network = 'google';
  result.rosterInfo.url = 'http://' + instanceId + '.testInstances.com/user=' + userId;
  result.description = 'Fake user: instance=' + instanceId + ', userId=' + userId;
  return result;
}

// Returns an instance message.
// |userInstance| should be the result value from a call to
// makeUserInstance().
function makeUserInstanceMessage(userInstance) {
  console.log('makeUserInstanceMessage(' + JSON.stringify(userInstance) + ')');
  var result = {
    fromUserId: userInstance.rosterInfo.userId,
    toUserId: 'you-should-not-be-checking-this',
    data: {
      type: 'notify-instance',
      instanceId: userInstance.instanceId,
      description: userInstance.description,
      keyHash: userInstance.keyHash,
      rosterInfo: userInstance.rosterInfo
    }
  };
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
// makeUserInstance.
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

  debugger;
  // Validate instanceToClient[] mapping.
  expect(store.state.instanceToClient).toBeDefined();
  expect(store.state.instanceToClient[inst.instanceId]).toBeDefined();
  // We don't have .in(), so reverse args and use .toContain()
  expect(store.state.roster[inst.rosterInfo.userId].clients).toContain(
      store.state.instanceToClient[inst.instanceId]);
}

describe("uproxy.state.instance", function () {
  // Try variants of [local state loading, network login,
  // instance ID reception].  Validate resulting state.

  var selfInstanceMessage = {
    userId: 'self@selfmail.com',
    name: 'My self.',
    network: 'google',
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

  var userInstances = [
    makeUserInstance('2222222222', 'secondUser'),
    makeUserInstance('3333333333', 'thirdUser'),
    makeUserInstance('4444444444', 'fourthUser'),
    makeUserInstance('5555555555', 'fifthUser'),
    makeUserInstance('6666666666', 'sixthUser')
  ];

  beforeEach(function () {
    // Stub out extension-related communications.  This may not be
    // necessary with freedom already stubbed out.
    spyOn(uproxy, 'sendInstance');
    spyOn(uproxy, '_SyncUI');
    // And stub out the identity service.
    spyOn(uproxy, 'identity');
  });

  it('onState-Roster-Instance', function() {
    // This should be the simplest way in.  You get a login for
    // yourself, then a roster, then instance notifications.
    var inst;
    debugger;
    receiveStatus(selfInstanceMessage);
    for (inst in userInstances) {
      receiveChange(userInstances[inst]);
    }
    debugger;
    // We have to wrap up the instance data in a message.
    for (inst in userInstances) {
      receiveInstance(makeUserInstanceMessage(userInstances[inst]));
    }

    // Now check it.
    validateSelf(selfInstanceMessage);
    for (inst in userInstances) {
      validateInstance(userInstances[inst]);
    }
  });
});

describe("uproxy.state.instance.fuzzer", function () {
  // Feed in randomized ordering of data, some of it bad, and make
  // sure internal validation can survive.
});