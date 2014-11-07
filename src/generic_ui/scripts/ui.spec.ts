/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='../../generic_core/consent.ts' />
/// <reference path='ui.ts' />

// TODO: move model, mockCore, and mockBrowserAction to a file
// where they can be re-used.
var model :UI.Model = {
  networks: [
  ],
  contacts: {
    'onlineTrustedUproxy': [],
    'offlineTrustedUproxy': [],
    'onlineUntrustedUproxy': [],
    'offlineUntrustedUproxy': [],
    'onlineNonUproxy': [],
    'offlineNonUproxy': []
  },
  description: ''
};

describe('UI.UserInterface', () => {

  var ui :UI.UserInterface;
  var mockBrowserAction;
  var updateToHandlerMap = {};

  beforeEach(() => {
    // Create a fresh UI object before each test.
    var mockCore = jasmine.createSpyObj('core', ['reset', 'onUpdate']);

    // Store all the handlers for Updates from core in a map.
    // These functions will be called directly from tests
    // instead of being triggered by events emitted from the core.
    mockCore.onUpdate.and.callFake((key :any, handler : any) => {
      updateToHandlerMap[key] = handler;
    });

    mockBrowserAction = jasmine.createSpyObj('browserAction', ['setIcon']);
    ui = new UI.UserInterface(mockCore, mockBrowserAction);
    model.networks = [];
    spyOn(console, 'log');
  });

  describe('syncUser', () => {

    it('Adds users to roster and contacts list', () => {
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, {name: 'testNetwork',
                     userId: 'fakeUser',
                     online: true,
                     roster: {}});
      var payload :UI.UserMessage = {
        network: 'testNetwork',
        user: {
          userId: 'testUserId',
          name: 'Alice',
          imageData: 'testImageData',
          isOnline: true
        },
        instances: []
      };
      ui.syncUser(payload);
      var user :UI.User = model.networks[0].roster['testUserId'];
      expect(user).toBeDefined();
      expect(model.contacts.onlineNonUproxy.length).toEqual(1);
      expect(model.contacts.onlineNonUproxy[0]).toEqual(user);
      expect(model.contacts.offlineNonUproxy.length).toEqual(0);
      expect(model.contacts.onlineTrustedUproxy.length).toEqual(0);
      expect(model.contacts.offlineTrustedUproxy.length).toEqual(0);
      expect(model.contacts.onlineUntrustedUproxy.length).toEqual(0);
      expect(model.contacts.offlineUntrustedUproxy.length).toEqual(0);
    });

    it('Sets correct flags for uProxy users', () => {
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, {name: 'testNetwork',
                     userId: 'fakeUser',
                     online: true,
                     roster: {}});
      var clientInstance :UI.Instance = {
        instanceId: 'instance1',
        description: 'description1',
        consent: new Consent.State(),
        access: {asClient: false, asProxy: false},
        isOnline: true,
        bytesSent: 0,
        bytesReceived: 0
      };
      clientInstance.consent.localRequestsAccessFromRemote = true;
      clientInstance.consent.remoteGrantsAccessToLocal = true;
      var serverInstance :UI.Instance = {
        instanceId: 'instance1',
        description: 'description1',
        consent: new Consent.State(),
        access: {asClient: false, asProxy: false},
        isOnline: true,
        bytesSent: 0,
        bytesReceived: 0
      };
      serverInstance.consent.localGrantsAccessToRemote = true;
      serverInstance.consent.remoteRequestsAccessFromLocal = true;
      var payload :UI.UserMessage = {
        network: 'testNetwork',
        user: {
          userId: 'testUserId',
          name: 'Alice',
          imageData: 'testImageData',
          isOnline: true
        },
        instances: [clientInstance, serverInstance]
      };
      ui.syncUser(payload);
      var user :UI.User = model.networks[0].roster['testUserId'];
      expect(user).toBeDefined();
    });
  }); // syncUser

  describe('Update giving and getting state in UI', () => {

    beforeEach(() => {
      proxyConfig = jasmine.createSpyObj('IBrowserProxyConfig',
          ['startUsingProxy', 'stopUsingProxy']);
    });

    it('isGivingAccess updates when you start and stop giving', () => {
      expect(ui.isGivingAccess()).toEqual(false);
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(ui.isGivingAccess()).toEqual(true);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(ui.isGivingAccess()).toEqual(false);
    });

    it('isGettingAccess updates when you start and stop getting', () => {
      // Note that setting and clearing instanceGettingAccessFrom is done in
      // polymer/instance.ts.
      expect(ui.isGettingAccess()).toEqual(false);
      ui.instanceGettingAccessFrom = 'testGiverId';
      expect(ui.isGettingAccess()).toEqual(true);
      ui.instanceGettingAccessFrom = null;
      expect(ui.isGettingAccess()).toEqual(false);
    });

    it('Extension icon changes when you start giving access', () => {
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-p.png');
    });

    it('Extension icon doesnt change if you stop giving to 1 of several ' +
        'getters', () => {
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-p.png');
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .not.toHaveBeenCalledWith('uproxy-19.png');
    });

    it('Extension icon changes if you stop giving to all getters',
        () => {
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-p.png');
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19.png');
    });

    it('Extension icon changes when you start getting access', () => {
      // Right now, the user can only start getting access by clicking the
      // start button, which directly calls ui.startGettingInUiAndConfig
      // if the core.start promise fulfills. (see polymer/instance.ts)
      // TODO (lucyhe): update this test if we add new ways to start
      // getting access.
      ui.startGettingInUiAndConfig({ address : 'testAddress' , port : 0 });
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-c.png');
    });

    it('Extension icon changes when you stop getting access', () => {
      ui.startGettingInUiAndConfig({ address : 'testAddress' , port : 0 });
      ui.instanceGettingAccessFrom = 'testGiverId';
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-c.png');
      updateToHandlerMap[uProxy.Update.STOP_GETTING_FROM_FRIEND]
          .call(ui, {instanceId: 'testGiverId', error: false});
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19.png');
    });
  });  // Update giving and/or getting state in UI

  describe('Sync network list', () => {

    var networkName0 = 'MockNetwork0';
    var networkName1 = 'MockNetwork1';

    var networkMessage = {
      name: networkName0,
      online: false,
      userId : ''
    };

    it('Add networks', () => {
      // Add a network
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, networkMessage);
      expect(model.networks.length).toEqual(1);
      expect(model.networks[0].name).toEqual(networkName0);

      // Add a new network
      networkMessage.name = networkName1;
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, networkMessage);
      expect(model.networks.length).toEqual(2);
      expect(model.networks[1].name).toEqual(networkName1);

      // Update existing network;
      networkMessage.online = true;
      networkMessage.userId = 'fakeUserID';
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, networkMessage);
      expect(model.networks.length).toEqual(2);
      expect(model.networks[0].online).toEqual(false);
      expect(model.networks[1].online).toEqual(true);

      // Log in with mockNetwork0.
      networkMessage.name = networkName0;
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, networkMessage);
      expect(model.networks.length).toEqual(2);
      expect(model.networks[0].online).toEqual(true);
      expect(model.networks[1].online).toEqual(true);
      expect(model.networks[0].roster).toEqual({});
      expect(model.networks[1].roster).toEqual({});

      // Add some users for both networks;
      // TODO(salomegeo): move this to beforeEach
      model.contacts.onlineNonUproxy = [];
      var payload :UI.UserMessage = {
        network: networkName0,
        user: {
          userId: 'testUserId',
          name: 'Alice',
          imageData: 'testImageData',
          isOnline: true
        },
        instances: []
      };
      ui.syncUser(payload);
      expect(model.contacts.onlineNonUproxy.length).toEqual(1);

      payload.network = networkName1;
      for (var i = 0; i < 10; i++) {
        payload.user.userId = 'testUserId' + i;
        ui.syncUser(payload);
      }
      expect(Object.keys(model.networks[0].roster).length).toEqual(1);
      expect(Object.keys(model.networks[1].roster).length).toEqual(10);
      expect(model.contacts.onlineNonUproxy.length).toEqual(11);

      // Log out from network1, make sure roster is clear
      // Check that it doesn't clear network0 buddylist
      networkMessage.online = false;
      networkMessage.name = networkName1;
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, networkMessage);
      expect(Object.keys(model.networks[0].roster).length).toEqual(1);
      expect(Object.keys(model.networks[1].roster).length).toEqual(0);
      expect(model.contacts.onlineNonUproxy.length).toEqual(1);
    });

    it('Clear roster after log out', () => {
    });
  });

  // TODO: more specs
});  // UI.UserInterface
