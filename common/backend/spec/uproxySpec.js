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
      onXMPP: false,
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
