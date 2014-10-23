/**
 * core.spec.ts
 *
 * There are a number of message types and interactions which prepare the
 * roster, clients, and instances. These have various caveats and edge cases,
 * and can also be received in different orders. This file lays out these
 * requirement and ensures consistency.
 */
/// <reference path='core.ts' />
/// <reference path='social.ts' />
/// <reference path='../uproxy.ts' />
/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

// declare var storage :Core.Storage;

describe('Core', () => {

  // Set up a fake network -> roster -> user -> instance chain.
  var network = <Social.Network><any>jasmine.createSpy('network');
  network.getUser = null;
  network['login'] = (remember:boolean) => { return Promise.resolve<void>() };
  var user = <Core.User><any>jasmine.createSpy('user');
  user.getInstance = null;
  user.notifyUI = () => {};
  user.getStorePath = () => { return 'fake/userpath'; };
  var alice = new Core.RemoteInstance(user, {
    instanceId: 'instance-alice',
    keyHash:    'fake-hash-alice',
    description: 'alice peer',
  });

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
    spyOn(console, 'error');
  });

  it('passes modifyConsent to the correct instance', () => {
    spyOn(Social, 'getNetwork').and.callFake(() => {
      return network;
    });
    spyOn(network, 'getUser').and.callFake(() => {
      return user;
    });
    spyOn(user, 'getInstance').and.callFake(() => {
      return alice;
    });
    spyOn(alice, 'modifyConsent');
    var command :uProxy.ConsentCommand = {
      path: {
        network: 'fake-network',
        userId: 'user-alice',
        instanceId: 'instance-alice'
      },
      action: Consent.UserAction.REQUEST
    };
    core.modifyConsent(command);
    expect(Social.getNetwork).toHaveBeenCalledWith('fake-network');
    expect(network.getUser).toHaveBeenCalledWith('user-alice');
    expect(user.getInstance).toHaveBeenCalledWith('instance-alice');
    expect(alice.modifyConsent).toHaveBeenCalledWith(Consent.UserAction.REQUEST);
  });

  it('relays incoming manual network messages to the manual network', () => {
    var manualNetwork :Social.ManualNetwork =
        new Social.ManualNetwork(Social.MANUAL_NETWORK_ID, 'Manual');

    spyOn(Social, 'getNetwork').and.returnValue(manualNetwork);
    spyOn(manualNetwork, 'receive');

    var senderClientId = 'dummy_sender';
    var message :uProxy.Message = {
      type: uProxy.MessageType.SIGNAL_FROM_SERVER_PEER,
      data: {
        elephants: 'have trunks',
        birds: 'do not'
      }
    };
    var command :uProxy.HandleManualNetworkInboundMessageCommand = {
      senderClientId: senderClientId,
      message: message
    };
    core.handleManualNetworkInboundMessage(command);

    expect(Social.getNetwork).toHaveBeenCalledWith(Social.MANUAL_NETWORK_ID);
    expect(manualNetwork.receive).toHaveBeenCalledWith(senderClientId, message);
  });

  it('login fails for invalid network', (done) => {
    core.login('nothing').catch(() => {
      expect(console.warn).toHaveBeenCalled();
      done();
    });
  });

  it('login continues to call login on correct network', (done) => {
    Social.networkNames['network'] = 'network';
    Social.pendingNetworks['network'] = network;
    spyOn(network, 'login').and.returnValue(Promise.resolve());
    core.login('network').then(done);
  });

});

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
  // TODO: re-implement for the new instance code maybe.
}

/*
TODO: Re-enable these tests / fuzzers when the new Instance code is ready.

describe('uproxy.state.instance', function () {
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
    waitsFor(function() { return completed; }, 'Reset never returned.', 50);
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

describe('uproxy.state.instance.fuzzer', function () {
  // Feed in randomized ordering of data, some of it bad, and make
  // sure internal validation can survive.
  var USER_STATE = {
    roster: false,
    instance: false
  };

  var numbers = [ 'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
                  'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
                  'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth',
                  'seventeenth', 'eighteenth', 'nineteenth', 'twentieth' ];

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
    waitsFor(function() { return completed; }, 'Reset never returned.', 50);
    // TODO(mollyling): Use a real random seed (e.g., the time), print it,
    // and wire-up a way to set it on test entry.
    random_seed = 1;
  });

  it('keeps login at front, random single instance and roster message per user',
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
      console.warn('Didn't get all ' + numbers.length +
          ' fake users with 500 tries.');
    }

    // Now check our state.
    validateSelf(selfInstanceAndStatusMessage);
    for (inst in userRoster) {
      validateInstance(makeInstanceMessage(userRoster[inst]).data);
    }
  });

  it('keeps login at front, and random #s of instances and roster messages',
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
        if (roster_entry.userId == 'secondUser@gmail.com') {
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
      console.warn('Didn't get all ' + numbers.length +
          ' fake users with 500 tries.');
      console.warn(' - state vector: ' + states.map(function(o) {
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
