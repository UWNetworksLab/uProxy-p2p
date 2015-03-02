/// <reference path='user.ts' />
/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />


describe('UI.User', () => {

  var user :UI.User;

  beforeEach(() => {
    spyOn(console, 'log');
  });

  function getInstance(id :string, description :string) :UI.Instance {
    return {
      instanceId: id,
      description: description,
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteGrantsAccessToLocal: false,
        remoteRequestsAccessFromLocal: false,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: false
      },
      localSharingWithRemote: SharingState.NONE,
      localGettingFromRemote: GettingState.NONE,
      isOnline: true,
      bytesSent: 0,
      bytesReceived: 0
    };
  }

  it('creates with the correct userId', () => {
    user = new UI.User('fakeuser', null);
    expect(user.userId).toEqual('fakeuser');
    expect(user.instances).toBeDefined();
  });

  it('updates with a profile', () => {
    user.update({
      userId: 'fakeuser',
      name: 'fakename',
      imageData: 'fakeimage.uri',
      timestamp: Date.now()
    });
    expect(user.name).toEqual('fakename');
    expect(user.imageData).toEqual('fakeimage.uri');
  });

  it('does not change description if only 1 instance', () => {
    user.instances = [getInstance('instance1', '')];
    user.updateInstanceDescriptions();
    expect(user.instances[0].description).toEqual('');
  });

  it('updates empty descriptions when multiple instances', () => {
    user.instances = [
      getInstance('instance1', ''),
      getInstance('instance2', 'laptop'),
      getInstance('instance3', '')
    ];
    user.updateInstanceDescriptions();
    expect(user.instances[0].description).toEqual('Computer 1');
    expect(user.instances[1].description).toEqual('laptop');
    expect(user.instances[2].description).toEqual('Computer 3');
  });

  // TODO: more specs

});  // UI.User
