/// <reference path='../../../../third_party/typings/jasmine/jasmine.d.ts' />

import user_interface = require('./ui');
import browser_api = require('../../interfaces/browser_api');
import BrowserAPI = browser_api.BrowserAPI;
import browser_connector = require('../../interfaces/browser_connector');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import CoreApi = uproxy_core_api.CoreApi;
import social = require('../../interfaces/social');
import user = require('./user');
import User = user.User;

describe('UI.UserInterface', () => {

  var ui :user_interface.UserInterface;
  var mockBrowserApi :BrowserAPI;
  var updateToHandlerMap :{[name :string] :Function} = {};
  var mockCore :CoreApi;

  beforeEach(() => {
    // Create a fresh UI object before each test.
    mockCore = jasmine.createSpyObj(
        'core',
        ['reset', 'onUpdate', 'sendCommand']);

    // Store all the handlers for Updates from core in a map.
    // These functions will be called directly from tests
    // instead of being triggered by events emitted from the core.
    (<jasmine.Spy>mockCore.onUpdate).and.callFake((key :any, handler : any) => {
      updateToHandlerMap[key] = handler;
    });

    mockBrowserApi = jasmine.createSpyObj('browserApi',
        ['setIcon', 'startUsingProxy', 'stopUsingProxy', 'openTab', 'showNotification', 'on']);
    ui = new user_interface.UserInterface(mockCore, mockBrowserApi);
    spyOn(console, 'log');
  });

  function getUserAndInstance(
      userId :string, userName :string, instanceId :string) : social.UserData {
    return {
      network: 'testNetwork',
      user: {
        userId: userId,
        name: userName,
        imageData: 'testImageData',
        isOnline: true
      },
      allInstanceIds: [instanceId],
      offeringInstances: [],
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: false,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: false
      },
      isOnline: true
    };
  }

  function syncUserAndInstance(
      userId :string, userName :string, instanceId :string) {
    ui.syncUser(getUserAndInstance(userId, userName, instanceId));
  }

  describe('syncUser', () => {

    it('Adds users to roster and contacts list', () => {
      updateToHandlerMap[uproxy_core_api.Update.NETWORK]
          .call(ui, {name: 'testNetwork',
                     userId: 'fakeUser',
                     online: true,
                     roster: {}});
      ui.syncUser(getUserAndInstance('testUserId', 'Alice', 'instance1'));
      var user :User = user_interface.model.onlineNetwork.roster['testUserId'];
      expect(user).toBeDefined();
      expect(user_interface.model.contacts.getAccessContacts.onlineTrustedUproxy.length).toEqual(0);
      expect(user_interface.model.contacts.getAccessContacts.offlineTrustedUproxy.length).toEqual(0);
      expect(user_interface.model.contacts.getAccessContacts.onlineUntrustedUproxy.length).toEqual(1);
      expect(user_interface.model.contacts.getAccessContacts.offlineUntrustedUproxy.length).toEqual(0);
      expect(user_interface.model.contacts.shareAccessContacts.onlineTrustedUproxy.length).toEqual(0);
      expect(user_interface.model.contacts.shareAccessContacts.offlineTrustedUproxy.length).toEqual(0);
      expect(user_interface.model.contacts.shareAccessContacts.onlineUntrustedUproxy.length).toEqual(1);
      expect(user_interface.model.contacts.shareAccessContacts.offlineUntrustedUproxy.length).toEqual(0);
    });

    it('Sets correct flags for uProxy users', () => {
      updateToHandlerMap[uproxy_core_api.Update.NETWORK]
          .call(ui, {name: 'testNetwork',
                     userId: 'fakeUser',
                     online: true,
                     roster: {}});
      var userMessage = getUserAndInstance('testUserId', 'Alice', 'instance1');
      userMessage.allInstanceIds.push('instance2');
      ui.syncUser(userMessage);
      var user :User = user_interface.model.onlineNetwork.roster['testUserId'];
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
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(ui.isGivingAccess()).toEqual(true);
      expect(ui['mapInstanceIdToUser_']['testGetterId'].isGettingFromMe)
          .toEqual(true);
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
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
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(user_interface.SHARING_ICON);
    });

    it('Extension icon doesnt change if you stop giving to 1 of several ' +
        'getters', () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      syncUserAndInstance('userId', 'userName', 'testGetterId2');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(user_interface.SHARING_ICON);
      expect((<jasmine.Spy>mockBrowserApi.setIcon).calls.count()).toEqual(1);
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect((<jasmine.Spy>mockBrowserApi.setIcon).calls.count()).toEqual(1);
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(<jasmine.Spy>mockBrowserApi.setIcon)
          .not.toHaveBeenCalledWith(user_interface.DEFAULT_ICON);
    });

    it('Extension icon changes if you stop giving to all getters',
        () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      syncUserAndInstance('userId', 'userName', 'testGetterId2');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(user_interface.SHARING_ICON);
      expect((<jasmine.Spy>mockBrowserApi.setIcon).calls.count()).toEqual(1);
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect((<jasmine.Spy>mockBrowserApi.setIcon).calls.count()).toEqual(1);
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(user_interface.DEFAULT_ICON);
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
          .toHaveBeenCalledWith(user_interface.GETTING_ICON);
    });

    it('Extension icon changes when you stop getting access', () => {
      syncUserAndInstance('userId', 'userName', 'testGiverId');
      ui.startGettingInUiAndConfig(
          'testGiverId', { address : 'testAddress' , port : 0 });
      ui['instanceGettingAccessFrom_'] = 'testGiverId';
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(user_interface.GETTING_ICON);
      updateToHandlerMap[uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND]
          .call(ui, {instanceId: 'testGiverId', error: false});
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(user_interface.DEFAULT_ICON);
    });

    it('Sharing status updates when you start and stop sharing', () => {
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(ui.sharingStatus).toEqual('Sharing access with Alice');
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(ui.sharingStatus).toEqual(null);
    });

    it('No notification when you stop sharing and are not already proxying', () => {
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(mockBrowserApi.showNotification).not.toHaveBeenCalled();
    });

    it('Notification when you stop sharing', () => {
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
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
      var networkMessage :social.NetworkMessage = {
        name:   'Facebook',
        userId: '1234',
        online: true
      };
      ui['syncNetwork_'](networkMessage);
      expect(user_interface.model.onlineNetwork).toBeDefined();
      expect(user_interface.model.onlineNetwork.name).toEqual(networkMessage.name);
      expect(user_interface.model.onlineNetwork.userId).toEqual(networkMessage.userId);
    });

    it('Clears fields when network goes offline', () => {
      // Login
      var networkMessage :social.NetworkMessage = {
        name:   'Facebook',
        userId: '1234',
        online: true
      };
      ui['syncNetwork_'](networkMessage);

      // Simulate a USER_SELF update to set name and imageData
      updateToHandlerMap[uproxy_core_api.Update.USER_SELF]
          .call(ui,
                {
                  network: 'Facebook',
                  user: {
                    name: 'testName',
                    userId: '1234',
                    imageData: 'imageData'
                  }
                });
      expect(user_interface.model.onlineNetwork.userName).toEqual('testName');
      expect(user_interface.model.onlineNetwork.imageData).toEqual('imageData');

      // Logout
      networkMessage  = {name: 'Facebook', userId: '', online: false};
      ui['syncNetwork_'](networkMessage);
      expect(user_interface.model.onlineNetwork).toEqual(null);
    });

  });  // syncNetwork_
  // TODO: more specs
});  // UI.UserInterface
