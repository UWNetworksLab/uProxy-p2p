/**
 * uproxySpec.js
 *
 * There are a number of message types and interactions which prepare the
 * roster, clients, and instances. These have various caveats and edge cases,
 * and can also be received in different orders. This file lays out these
 * requirement and ensures consistency.
 */

/* jshint debug: true */
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
      imageData: null,
      url: null
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


// Fake an entry in the instance table.
var fakeInstanceSync = function(userId, clientId, data) {
  state.instances[data.instanceId] = {
    instanceId: data.instanceId,
    rosterInfo: {
      userId: userId,
    }
  };
};

describe("uproxy.receiveInstance", function() {
  var instanceMsg = restrictKeys(C.DEFAULT_MESSAGE_ENVELOPE, {
    fromUserId: 'alice',
    fromClientId: 'alice-clientid',
    toUserId: '',
    data: restrictKeys(C.DEFAULT_INSTANCE_MESSAGE, {
      instanceId: '12345',
      rosterInfo: restrictKeys(C.DEFAULT_INSTANCE_MESSAGE_ROSTERINFO, {
        name: 'Alice Testuser',
        network: 'google'
      })
    }),
  });

  beforeEach(function() {
    spyOn(store, 'syncInstanceFromInstanceMessage')
        .and.callFake(fakeInstanceSync);
    spyOn(store, 'saveInstance');
    spyOn(uproxy, '_syncInstanceUI');
  });

  it('syncs and saves new instances.', function() {
    receiveInstance(instanceMsg);
    expect(store.syncInstanceFromInstanceMessage)
      .toHaveBeenCalledWith('alice', 'alice-clientid',
                            instanceMsg.data);
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

  // CLEAR STATE BEFORE FUZZ TESTS.
  state.instances = [];
});

// Returns an object representing a single user instance.  Conforms to
// C.DEFAULT_ROSTER_ENTRY.
function makeUserRosterEntry(instanceId, userId, not_as_uproxy) {
  var result = cloneDeep(C.DEFAULT_ROSTER_ENTRY);
  userId = userId + '@gmail.com';
  var clientId;
  clientId = userId + (not_as_uproxy?
      '/other-messenger' : ('/uproxy' + instanceId));
  result.userId = userId;
  // validate for missing fields.
  result = restrictKeys(C.DEFAULT_ROSTER_ENTRY, result);
  result.clients[clientId] = restrictKeys(
      C.DEFAULT_ROSTER_CLIENT_ENTRY, {
        userId: userId,
        clientId: clientId,
        network: 'google',
        status: 'online',
        name: 'User' + userId,
      });
  return result;
}

// Returns an instance message from a roster entry.
// (C.DEFAULT_ROSTER_ENTRY ->
//        C.DEFAULT_MESSAGE_ENVELOPE{data=C.DEFAULT_INSTANCE_MESSAGE}).
// |userInstance| should be the result value from a call to
// makeUserRosterEntry(), a C.DEFAULT_ROSTER_ENTRY.
function makeInstanceMessage(userRosterEntry) {
  var result = cloneDeep(C.DEFAULT_MESSAGE_ENVELOPE);
  var client = userRosterEntry.clients[Object.keys(userRosterEntry.clients)[0]];
  result.fromUserId = userRosterEntry.userId;
  result.fromClientId = client.clientId;
  result.toUserId = 'you-should-not-be-checking-this';
  result = restrictKeys(C.DEFAULT_MESSAGE_ENVELOPE, result);

  var result_data = cloneDeep(C.DEFAULT_INSTANCE_MESSAGE);
  // pull the instanceID out of the clientID.
  var instanceId;
  if (client.clientId.indexOf('/uproxy') > 0) {
    instanceId = client.clientId.substr(userRosterEntry.userId.length +
        '/uproxy'.length);
  } else {
    throw new Error('Being asked to make an instance message for a non-uproxy client.');
  }
  result_data.instanceId = instanceId;
  result_data.description = 'description for user ' + userRosterEntry.userId;
  result_data.keyHash = 'HASHFORINSTANCE-' + instanceId;
  result_data = restrictKeys(C.DEFAULT_INSTANCE_MESSAGE, result_data);

  result_data.rosterInfo = restrictKeys(C.DEFAULT_INSTANCE_MESSAGE_ROSTERINFO, {
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
  try {
    var modelInst = store.state.instances[inst.instanceId];
    expect(modelInst).toBeDefined();
    expect(modelInst.instanceId).toBe(inst.instanceId);
    expect(modelInst.userID).toBe(inst.userId);
    expect(modelInst.network).toBe(inst.network);
    expect(modelInst.url).toBe(inst.url);
    expect(modelInst.description).toBe(inst.description);
    expect(modelInst.keyHash).toBe(inst.keyHash);
    expect(modelInst.trust).toBeDefined();
    expect(modelInst.trust.asProxy).toBe(Trust.NO);
    expect(modelInst.trust.asClient).toBe(Trust.NO);
    expect(modelInst.status).toBeDefined();
    expect(modelInst.status.proxy).toBe(C.DEFAULT_PROXY_STATUS.proxy);
    expect(modelInst.status.client).toBe(C.DEFAULT_PROXY_STATUS.client);

    // Validate clientToInstance[] mapping.
    expect(store.state.clientToInstance).toBeDefined();
    expect(Object.keys(store.state.clientToInstance).filter(function(client) {
      return store.state.clientToInstance[client] == inst.instanceId;
    }).length).toBe(1);

    // Validate instanceToClient[] mapping.
    expect(store.state.instanceToClient).toBeDefined();
    expect(store.state.instanceToClient[inst.instanceId]).toBeDefined();
    var user = store.state.roster[inst.rosterInfo.userId];
    // We don't have .in(), so reverse args and use .toContain()
    if (!user.clients[store.state.instanceToClient[inst.instanceId]]) {
      debugger;
    }
    console.log(user.clients);
    expect(Object.keys(user.clients)).toContain(
        store.state.instanceToClient[inst.instanceId]);
  } catch (e) {
    debugger;
  }
}

// conforms both to C.DEFAULT_STATUS and C.DEFAULT_INSTANCE.
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

/*
describe("uproxy.state.instance", function () {
  // Try variants of [local state loading, network login,
  // instance ID reception].  Validate resulting state.

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
    // receiveStatus expects a C.DEFAULT_STATUS message.
    receiveStatus(selfInstanceAndStatusMessage);

    // receiveChange expects a C.DEFAULT_INSTANCE message.
    receiveChange(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      receiveChange(userRoster[inst]);
    }

    // We have to wrap up the instance data in a C.DEFAULT_INSTANCE_MESSAGE
    // message.  receiveInstance expects a C.DEFAULT_INSTANCE_MESSAGE.
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
    // receiveStatus expects a C.DEFAULT_STATUS message.
    receiveStatus(selfInstanceAndStatusMessage);

    // We have to wrap up the instance data in a C.DEFAULT_INSTANCE_MESSAGE
    // message.
    for (inst in userRoster) {
      receiveInstance(makeInstanceMessage(userRoster[inst]));
    }

    // receiveChange expects a C.DEFAULT_INSTANCE message.
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
    // receiveStatus expects a C.DEFAULT_STATUS message.
    receiveStatus(selfInstanceAndStatusMessage);
    receiveChange(selfInstanceAndStatusMessage);

    // We have to wrap up the instance data in a C.DEFAULT_INSTANCE_MESSAGE
    // message.  receiveChange expects a C.DEFAULT_INSTANCE
    // message. receiveInstance expects a C.DEFAULT_INSTANCE_MESSAGE.
    for (inst in userRoster) {
      receiveInstance(makeInstanceMessage(userRoster[inst]));
      receiveChange(userRoster[inst]);
    }

    // Now check our state.
    validateSelf(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      validateInstance(makeInstanceMessage(userRoster[inst]).data);
    }
  });
});

function repeatObject(obj, num) {
  var result = [];
  while(num--) {
    result.push(cloneDeep(obj));
  }
  return result;
}

describe("uproxy.state.instance.fuzzer", function () {
  // Feed in randomized ordering of data, some of it bad, and make
  // sure internal validation can survive.
  var USER_STATE = {
    roster: false,
    instance: false
  };

  var numbers = [ "first", "second", "third", "fourth", "fifth", "sixth",
                  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
                  "thirteenth", "fourteenth", "fifteenth", "sixteenth",
                  "seventeenth", "eighteenth", "nineteenth", "twentieth" ];

  var sendMessageSpy;
  var random_seed;

  var check_all_instances = function(instances, check_roster, check_instance) {
    var i;
    for (i in Object.keys(instances)) {
      // note: true is greater than false.
      if (check_roster && (check_roster > instances[i].roster)) {
        return false;
      }
      if (check_instance && (check_instance > instances[i].instance)) {
        return false;
      }
    }
    return true;
  };

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
    // TODO(mollyling): Use a real random seed (e.g., the time), print it,
    // and wire-up a way to set it on test entry.
    random_seed = 1;
  });

  it("keeps login at front, random single instance and roster message per user",
     function() {
    var i, inst,
        states = repeatObject(USER_STATE, numbers.length),
        num_attempts = 0, MAX_ATTEMPTS = 100,
        userRoster = [];
    for (i = 0; i < numbers.length; ++i) {
      var nm = repeatObject('' + (i + 1), 8).toString().replace(/,/g, '');
      userRoster.push(makeUserRosterEntry(nm, numbers[i] + 'User'));
    }

    // Log us in.
    receiveStatus(selfInstanceAndStatusMessage);
    receiveChange(selfInstanceAndStatusMessage);

    // Now randomly send 5 instance or roster messages, and then see if we've
    // gotten everyone.  This will clearly go a few times before finishing.
    do {
      for (i = 0; i < 5; ++i) {
        random_seed = linear_congruence_gen(random_seed);
        var index = random_seed % numbers.length;
        random_seed = linear_congruence_gen(random_seed);
        var do_roster = random_seed % 2;
        if (do_roster) {
          receiveChange(userRoster[index]);
          states[index].roster = true;
        } else {
          receiveInstance(makeInstanceMessage(userRoster[index]));
          states[index].instance = true;
        }
      }
      num_attempts++;
    } while(!check_all_instances(states, true, true) &&
            num_attempts < MAX_ATTEMPTS);

    if (!check_all_instances(states, true, true)) {
      console.warn("Didn't get all " + numbers.length +
          " fake users with 500 tries.");
    }

    // Now check our state.
    validateSelf(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      validateInstance(makeInstanceMessage(userRoster[inst]).data);
    }
  });

  it("keeps login at front, and random #s of instances and roster messages",
     function() {
    var i, inst, nm, roster_entry;
    var state_template = cloneDeep(USER_STATE);
    // Make the state template integers instead of bools
    state_template.roster = 0;
    state_template.instance = 0;

    var kNumMinimumRosterMessages = 3;
    var kNumMinimumInstanceMessages = 3;
    var kNumInnerTries = 5;
    var kNumAttempts = 500;
    var states = repeatObject(state_template, numbers.length);
    var num_attempts = 0;

    // Log us in.
    receiveStatus(selfInstanceAndStatusMessage);
    receiveChange(selfInstanceAndStatusMessage);

    // Now randomly send 5 instance or roster messages, and then see if we've
    // gotten everyone.  This will clearly go a few times before finishing.
    do {
      for (i = 0; i < kNumInnerTries; ++i) {
        random_seed = linear_congruence_gen(random_seed);
        var index = random_seed % numbers.length;
        random_seed = linear_congruence_gen(random_seed);
        var do_roster = random_seed % 2;
        nm = repeatObject('' + (index + 1), 8).toString().replace(/,/g, '');
        random_seed = linear_congruence_gen(random_seed);
        var is_uproxy = (random_seed % 2) > 0? true: false;
        roster_entry = makeUserRosterEntry(nm, numbers[index] + 'User',
                                           !is_uproxy);
        if (roster_entry.userId == "secondUser@gmail.com") {
          debugger;
        }
        if (do_roster) {
          receiveChange(roster_entry);
          states[index].roster++;
        } else if (is_uproxy) {
          receiveInstance(makeInstanceMessage(roster_entry));
          states[index].instance++;
        }
      }
      num_attempts++;
    } while(!check_all_instances(states, kNumMinimumRosterMessages,
                                 kNumMinimumInstanceMessages) &&
                                     num_attempts < kNumAttempts);

    if (!check_all_instances(states, kNumMinimumRosterMessages,
                             kNumMinimumInstanceMessages)) {
      console.warn("Didn't get all " + numbers.length +
          " fake users with 500 tries.");
      console.warn(" - state vector: " + states.map(function(o) {
        return JSON.stringify(o); }).toString());
    }

    // Now check our state.
    validateSelf(selfInstanceAndStatusMessage);
    for (i = 0; i < numbers.length; i++) {
      nm = repeatObject('' + (i + 1), 8).toString().replace(/,/g, '');
      roster_entry = makeUserRosterEntry(nm, numbers[i] + 'User');
      validateInstance(makeInstanceMessage(roster_entry).data);
    }
  });

});
*/
