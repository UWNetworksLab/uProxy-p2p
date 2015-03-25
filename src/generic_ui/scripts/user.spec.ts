/// <reference path='user.ts' />
/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />

describe('UI.User', () => {
  var user :UI.User;
  var notify :jasmine.Spy;

  beforeEach(() => {
    spyOn(console, 'log');
    notify = jasmine.createSpy('notify');
    user = new UI.User('fakeuser', null, notify);
    user.update(makeUpdateMessage({}));
  });

  function getInstance(id :string, description :string) :UI.Instance {
    return {
      instanceId: id,
      description: description,
      localSharingWithRemote: SharingState.NONE,
      localGettingFromRemote: GettingState.NONE,
      isOnline: true,
      bytesSent: 0,
      bytesReceived: 0
    };
  }

  // adds any missing fields to an object to make it a valid update message
  function makeUpdateMessage(update :Object) {
    var result :UI.UserMessage = <UI.UserMessage>update;

    if (!('network' in result)) {
      result.network = 'testNetwork';
    }

    if (!('user' in result)) {
      result.user = {
        userId: 'fakeuser',
        name: 'fakename',
        imageData: 'fakeimage.uri',
        timestamp: Date.now()
      };
    }

    if (!('offeringInstances' in result)) {
      result.offeringInstances = [];
    }

    if (!('allInstanceIds' in result)) {
      result.allInstanceIds = [];
    }

    if (!('isOnline' in result)) {
      result.isOnline = true;
    }

    if (!('consent' in result)) {
      result.consent = {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: false,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: false
      };
    }

    return result;
  }

  it('check default state', () => {
    expect(user.userId).toEqual('fakeuser');
    expect(user.offeringInstances).toEqual([]);
    expect(user.allInstanceIds).toEqual([]);
    expect(user.name).toEqual('fakename');
    expect(user.imageData).toEqual('fakeimage.uri');
  });

  it('does not change description if only 1 instance', () => {
    user.update(makeUpdateMessage({
      allInstanceIds: [
        'instance1'
      ],
      offeringInstances: [
        getInstance('instance1', '')
      ]
    }));
    expect(user.offeringInstances[0].description).toEqual('');
  });

  it('updates empty descriptions when multiple instances', () => {
    user.update(makeUpdateMessage({
      allInstanceIds: [
        'instance1',
        'instance2',
        'instance3'
      ],
      offeringInstances: [
        getInstance('instance1', ''),
        getInstance('instance2', 'laptop'),
        getInstance('instance3', '')
      ]
    }));
    expect(user.offeringInstances[0].description).toEqual('Computer 1');
    expect(user.offeringInstances[1].description).toEqual('laptop');
    expect(user.offeringInstances[2].description).toEqual('Computer 3');
  });

  it('show notification if isOffering changes when not ignoring', () => {
    user.update(makeUpdateMessage({
      allInstanceIds: [
        'instance1'
      ],
      offeringInstances: [
        getInstance('instance1', '')
      ]
    }));

    expect(notify).toHaveBeenCalledWith(
        user.name + ' offered you access', jasmine.any(Object));
  });

  it('does not show notification if isOffering changes when ignoring', () => {
    user.update(makeUpdateMessage({
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: false,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: true
      },
      allInstanceIds: [
        'instance1'
      ],
      offeringInstances: [
        getInstance('instance1', '')
      ]
    }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('shows notificaion if isRequesting changes when not ignoring', () => {
    user.update(makeUpdateMessage({
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: true,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: false
      }
    }));
    expect(notify).toHaveBeenCalledWith(
        user.name + ' is requesting access', jasmine.any(Object))
  });

  it('does not show notificaion if isRequesting changes when ignoring', () => {
    user.update(makeUpdateMessage({
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: true,
        ignoringRemoteUserRequest: true,
        ignoringRemoteUserOffer: false
      }
    }));
    expect(notify).not.toHaveBeenCalled();
  });
  // TODO: more specs
});  // UI.User
