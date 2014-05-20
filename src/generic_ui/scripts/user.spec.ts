/// <reference path='../../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='user.ts' />

describe('UI.User', () => {

  var user :UI.User;

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
  });

  it('creates with the correct userId', () => {
    user = new UI.User('fakeuser');
    expect(user.userId).toEqual('fakeuser');
    expect(user.clients).toBeDefined();
    expect(user.instances).toBeDefined();
  });

  it('updates with a profile', () => {
    user.update({
      userId: 'fakeuser',
      name: 'fakename',
      url: 'fake.url',
      imageData: 'fakeimage.uri',
      timestamp: Date.now()
    })
    expect(user.name).toEqual('fakename');
    expect(user.url).toEqual('fake.url');
    expect(user.imageData).toEqual('fakeimage.uri');
  });

  describe('status flags', () => {

    it('offline if there are only offline clients', () => {
      user.refreshStatus([
        UProxyClient.Status.OFFLINE,
        UProxyClient.Status.OFFLINE
      ])
      expect(user.online).toEqual(false);
      expect(user.canUProxy).toEqual(false);
    });

    it('online if there is at least one non-offline client', () => {
      user.refreshStatus([
        UProxyClient.Status.OFFLINE,
        UProxyClient.Status.ONLINE_WITH_OTHER_APP
      ])
      expect(user.online).toEqual(true);
      expect(user.canUProxy).toEqual(false);
    });

    it('can uProxy if there is at least one online client', () => {
      user.refreshStatus([
        UProxyClient.Status.OFFLINE,
        UProxyClient.Status.ONLINE_WITH_OTHER_APP,
        UProxyClient.Status.ONLINE
      ])
      expect(user.online).toEqual(true);
      expect(user.canUProxy).toEqual(true);
    });

  });

  it('sets instances', () => {
    user.setInstances([{
      instanceId: 'fakeinstance',
      description: 'im so fake',
      consent: {
        asClient: Consent.ClientState.NONE,
        asProxy:  Consent.ProxyState.NONE
      },
      access: {
        asClient: false,
        asProxy: false
      }
    }]);
    expect(user.instances).toEqual([{
      instanceId: 'fakeinstance',
      description: 'im so fake',
      consent: {
        asClient: Consent.ClientState.NONE,
        asProxy:  Consent.ProxyState.NONE
      },
      access: {
        asClient: false,
        asProxy: false
      }
    }]);
  });

  // TODO: more specs

});  // UI.User
