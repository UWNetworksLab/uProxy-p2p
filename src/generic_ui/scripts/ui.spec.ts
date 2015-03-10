/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='ui.ts' />

describe('UI.UserInterface', () => {

  var ui :UI.UserInterface;
  var mockBrowserApi;
  var updateToHandlerMap = {};
  var mockCore;

  function getInstance(instanceId :string, description :string) :UI.Instance {
    return {
      instanceId: instanceId,
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
    }
  }

  beforeEach(() => {
    // Create a fresh UI object before each test.
    mockCore = jasmine.createSpyObj(
        'core',
        ['reset', 'onUpdate', 'sendCommand']);

    // Store all the handlers for Updates from core in a map.
    // These functions will be called directly from tests
    // instead of being triggered by events emitted from the core.
    mockCore.onUpdate.and.callFake((key :any, handler : any) => {
      updateToHandlerMap[key] = handler;
    });

    mockBrowserApi = jasmine.createSpyObj('browserApi',
        ['setIcon', 'startUsingProxy', 'stopUsingProxy', 'openTab', 'showNotification']);
    ui = new UI.UserInterface(mockCore, mockBrowserApi);
    spyOn(console, 'log');
  });

  function syncUserAndInstance(
      userId :string, userName :string, instanceId :string) {
    var payload :UI.UserMessage = {
      network: 'testNetwork',
      user: {
        userId: userId,
        name: userName,
        imageData: 'testImageData'
      },
      instances: [
        getInstance(instanceId, 'description1')
      ]
    };
    ui.syncUser(payload);
  }

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
          imageData: 'testImageData'
        },
        instances: [
          getInstance('instance1', 'description1')
        ]
      };
      ui.syncUser(payload);
      var user :UI.User = model.onlineNetwork.roster['testUserId'];
      expect(user).toBeDefined();
      expect(model.contacts.getAccessContacts.onlineTrustedUproxy.length).toEqual(0);
      expect(model.contacts.getAccessContacts.offlineTrustedUproxy.length).toEqual(0);
      expect(model.contacts.getAccessContacts.onlineUntrustedUproxy.length).toEqual(1);
      expect(model.contacts.getAccessContacts.offlineUntrustedUproxy.length).toEqual(0);
      expect(model.contacts.shareAccessContacts.onlineTrustedUproxy.length).toEqual(0);
      expect(model.contacts.shareAccessContacts.offlineTrustedUproxy.length).toEqual(0);
      expect(model.contacts.shareAccessContacts.onlineUntrustedUproxy.length).toEqual(1);
      expect(model.contacts.shareAccessContacts.offlineUntrustedUproxy.length).toEqual(0);
    });

    it('Sets correct flags for uProxy users', () => {
      updateToHandlerMap[uProxy.Update.NETWORK]
          .call(ui, {name: 'testNetwork',
                     userId: 'fakeUser',
                     online: true,
                     roster: {}});
      var clientInstance = getInstance('instance1', 'description1');
      clientInstance.consent.localRequestsAccessFromRemote = true;
      clientInstance.consent.remoteGrantsAccessToLocal = true;

      var serverInstance = getInstance('instance2', 'description2');
      serverInstance.consent.localGrantsAccessToRemote = true;
      serverInstance.consent.remoteRequestsAccessFromLocal = true;

      var payload :UI.UserMessage = {
        network: 'testNetwork',
        user: {
          userId: 'testUserId',
          name: 'Alice',
          imageData: 'testImageData'
        },
        instances: [clientInstance, serverInstance]
      };
      ui.syncUser(payload);
      var user :UI.User = model.onlineNetwork.roster['testUserId'];
      expect(user).toBeDefined();
      expect(ui['mapInstanceIdToUser_']['instance1'].name).toEqual('Alice');
      expect(ui['mapInstanceIdToUser_']['instance2'].name).toEqual('Alice');
    });
  }); // syncUser

  describe('Update giving and getting state in UI', () => {

    // TODO (lucyhe): Add tests for users who are giving and getting
    // simultaneously.

    it('isGivingAccess updates when you start and stop giving', () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      expect(ui.isGivingAccess()).toEqual(false);
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(ui.isGivingAccess()).toEqual(true);
      expect(ui['mapInstanceIdToUser_']['testGetterId'].isGettingFromMe)
          .toEqual(true);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(ui.isGivingAccess()).toEqual(false);
      expect(ui['mapInstanceIdToUser_']['testGetterId'].isGettingFromMe)
          .toEqual(false);
    });

    it('isGettingAccess updates when you start and stop getting', () => {
      // Note that setting and clearing instanceGettingAccessFrom_ is done in
      // ui.ts.
      syncUserAndInstance('userId', 'userName', 'instanceId');
      expect(ui.isGettingAccess()).toEqual(false);
      ui['instanceGettingAccessFrom_'] = 'testGiverId';
      expect(ui.isGettingAccess()).toEqual(true);
      ui['instanceGettingAccessFrom_'] = null;
      expect(ui.isGettingAccess()).toEqual(false);
    });

    it('Extension icon changes when you start giving access', () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(UI.SHARING_ICON);
    });

    it('Extension icon doesnt change if you stop giving to 1 of several ' +
        'getters', () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      syncUserAndInstance('userId', 'userName', 'testGetterId2');
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(UI.SHARING_ICON);
      expect(mockBrowserApi.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect(mockBrowserApi.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserApi.setIcon)
          .not.toHaveBeenCalledWith(UI.DEFAULT_ICON);
    });

    it('Extension icon changes if you stop giving to all getters',
        () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      syncUserAndInstance('userId', 'userName', 'testGetterId2');
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(UI.SHARING_ICON);
      expect(mockBrowserApi.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect(mockBrowserApi.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(UI.DEFAULT_ICON);
    });

    it('Extension icon changes when you start getting access', () => {
      // Right now, the user can only start getting access by clicking the
      // start button, which directly calls ui.startGettingInUiAndConfig
      // if the core.start promise fulfills. (see polymer/instance.ts)
      // TODO (lucyhe): update this test if we add new ways to start
      // getting access.
      syncUserAndInstance('userId', 'userName', 'testInstanceId');
      ui.startGettingInUiAndConfig(
          'testInstanceId', { address : 'testAddress' , port : 0 });
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(UI.GETTING_ICON);
    });

    it('Extension icon changes when you stop getting access', () => {
      syncUserAndInstance('userId', 'userName', 'testGiverId');
      ui.startGettingInUiAndConfig(
          'testGiverId', { address : 'testAddress' , port : 0 });
      ui['instanceGettingAccessFrom_'] = 'testGiverId';
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(UI.GETTING_ICON);
      updateToHandlerMap[uProxy.Update.STOP_GETTING_FROM_FRIEND]
          .call(ui, {instanceId: 'testGiverId', error: false});
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(UI.DEFAULT_ICON);
    });

    it('Sharing status updates when you start and stop sharing', () => {
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(ui.sharingStatus).toEqual('Sharing access with Alice');
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(ui.sharingStatus).toEqual(null);
    });

    it('No notification when you stop sharing and are not already proxying', () => {
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(mockBrowserApi.showNotification).not.toHaveBeenCalled();
    });

    it('Notification when you stop sharing', () => {
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(mockBrowserApi.showNotification).toHaveBeenCalled();
    });

    it('Getting status updates when you start and stop getting', () => {
      // Note that setting and clearing instanceGettingAccessFrom_ is done in
      // polymer/instance.ts.
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      expect(ui.gettingStatus).toEqual(null);
      ui['instanceGettingAccessFrom_'] = 'testInstanceId';
      ui['updateGettingStatusBar_']();
      expect(ui.gettingStatus).toEqual('Getting access from Alice');
      ui['instanceGettingAccessFrom_'] = null;
      ui['updateGettingStatusBar_']();
      expect(ui.gettingStatus).toEqual(null);
    });
  });  // Update giving and/or getting state in UI

  describe('syncNetwork_', () => {

    it('Updates onlineNetwork', () => {
      var networkMessage :UI.NetworkMessage = {
        name:   'Facebook',
        userId: '1234',
        online: true
      };
      ui['syncNetwork_'](networkMessage);
      expect(model.onlineNetwork).toBeDefined();
      expect(model.onlineNetwork.name).toEqual(networkMessage.name);
      expect(model.onlineNetwork.userId).toEqual(networkMessage.userId);
    });

    it('Clears fields when network goes offline', () => {
      // Login
      var networkMessage :UI.NetworkMessage = {
        name:   'Facebook',
        userId: '1234',
        online: true
      };
      ui['syncNetwork_'](networkMessage);

      // Simulate a USER_SELF update to set name and imageData
      updateToHandlerMap[uProxy.Update.USER_SELF]
          .call(ui,
                {
                  network: 'Facebook',
                  user: {
                    name: 'testName',
                    userId: '1234',
                    imageData: 'imageData'
                  }
                });
      expect(model.onlineNetwork.userName).toEqual('testName');
      expect(model.onlineNetwork.imageData).toEqual('imageData');

      // Logout
      networkMessage  = {name: 'Facebook', userId: '', online: false};
      ui['syncNetwork_'](networkMessage);
      expect(model.onlineNetwork).toEqual(null);
    });

  });  // syncNetwork_
  // TODO: more specs
});  // UI.UserInterface
