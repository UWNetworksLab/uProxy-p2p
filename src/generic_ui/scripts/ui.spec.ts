/// <reference path='../../../../third_party/typings/browser.d.ts' />

import user_interface = require('./ui');
import ui_constants = require('../../interfaces/ui');
import browser_api = require('../../interfaces/browser_api');
import background_ui = require('./background_ui');
import BrowserAPI = browser_api.BrowserAPI;
import browser_connector = require('../../interfaces/browser_connector');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import CoreConnector = require('./core_connector');
import social = require('../../interfaces/social');
import user = require('./user');
import User = user.User;
import Constants = require('./constants');
import _ = require('lodash');

describe('UI.UserInterface', () => {
  var ui :user_interface.UserInterface;
  var mockBrowserApi :BrowserAPI;
  var updateToHandlerMap :{[name :string] :Function} = {};
  var mockCore :CoreConnector;
  var mockBackgroundUi :background_ui.BackgroundUi;

  beforeEach(() => {
    // Create a fresh UI object before each test.
    mockCore = jasmine.createSpyObj(
        'core',
        [
          'reset',
          'onUpdate',
          'sendCommand',
          'on',
          'connect',
          'getFullState',
          'stop',
          'logout'
        ]);

    // assume connect always resolves immediately
    (<jasmine.Spy>mockCore.connect).and.returnValue(Promise.resolve());
    (<jasmine.Spy>mockCore.logout).and.returnValue(Promise.resolve());

    (<jasmine.Spy>mockCore.getFullState).and.returnValue(Promise.resolve({
      networkNames: [
        'testNetwork'
      ],
      globalSettings: {
      }
    }));

    // Store all the handlers for Updates from core in a map.
    // These functions will be called directly from tests
    // instead of being triggered by events emitted from the core.
    (<jasmine.Spy>mockCore.onUpdate).and.callFake((key :any, handler : any) => {
      updateToHandlerMap[key] = handler;
    });

    mockBrowserApi = jasmine.createSpyObj('browserApi',
        ['setIcon',
         'startUsingProxy',
         'stopUsingProxy',
         'openTab',
         'showNotification',
         'on',
         'handlePopupLaunch',
         'bringUproxyToFront',
         'setBadgeNotification',
         'isConnectedToCellular'
         ]);

    mockBackgroundUi = jasmine.createSpyObj('backgroundUi', [
        'registerAsFakeBackground',
        'fireSignal',
        'openDialog'
    ]);

    ui = new user_interface.UserInterface(mockCore, mockBrowserApi, mockBackgroundUi);
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
      isOnline: true,
      instancesSharingWithLocal: []
    };
  }

  function syncUserAndInstance(
      userId :string, userName :string, instanceId :string) {
    ui.syncUser(getUserAndInstance(userId, userName, instanceId));
  }

  function login() {
    updateToHandlerMap[uproxy_core_api.Update.NETWORK]
        .call(ui, {name: 'testNetwork',
                   userId: 'fakeUser',
                   online: true,
                  });
  }

  function logout() {
    updateToHandlerMap[uproxy_core_api.Update.NETWORK]
        .call(ui, {name: 'testNetwork',
                   userId: 'fakeUser',
                   online: false,
                  });
  }

  function addRemotePeer() {
    updateToHandlerMap[uproxy_core_api.Update.USER_FRIEND]
        .call(ui, <social.UserData>{
                    allInstanceIds: ['testInstance'],
                    consent: {
                      ignoringRemoteUserOffer: false,
                      ignoringRemoteUserRequest: false,
                      localGrantsAccessToRemote: true,
                      localRequestsAccessFromRemote: true,
                      remoteRequestsAccessFromLocal: true,
                    },
                    isOnline: true,
                    network: 'testNetwork',
                    offeringInstances: [],
                    instancesSharingWithLocal: [],
                    user: {
                      userId: 'testUser',
                    },
                  });
  }

  function startProxyingForRemotePeer() {
    updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
        .call(ui, 'testInstance');
  }

  describe('synced users are correctly exposed', () => {
    beforeEach(login);
    afterEach(logout);

    it('Adding a user with no information is categorized as untrusted', () => {
      ui.syncUser(getUserAndInstance('testUserId', 'Alice', 'instance1'));
      var network = ui.model.getNetwork('testNetwork');
      var user = ui.model.getUser(network, 'testUsedId');

      expect(user).toBeDefined();
      var contacts = ui.model.contacts;

      expect(contacts.getAccessContacts.trustedUproxy.length).toEqual(0);
      expect(contacts.getAccessContacts.untrustedUproxy.length).toEqual(1);
      expect(contacts.shareAccessContacts.trustedUproxy.length).toEqual(0);
      expect(contacts.shareAccessContacts.untrustedUproxy.length).toEqual(1);
    });
  });


  describe('syncNetwork_', () => {
    beforeEach(login);
    afterEach(logout);

    it('Network visible in model', () => {
      expect(ui.model.onlineNetworks.length).toEqual(1);

      var network = ui.model.getNetwork('testNetwork');
      expect(network.name).toEqual('testNetwork');
      expect(network.userId).toEqual('fakeUser');
    });

    it('Updates user after user_sync message', () => {
      // Simulate a USER_SELF update to set name and imageData
      updateToHandlerMap[uproxy_core_api.Update.USER_SELF]
          .call(ui,
                {
                  network: 'testNetwork',
                  user: {
                    name: 'testName',
                    userId: 'fakeUser',
                    imageData: 'imageData'
                  }
                });

      var network = ui.model.getNetwork('testNetwork');

      expect(network.userName).toEqual('testName');
      expect(network.imageData).toEqual('imageData');
    });
  });

  describe('syncNetwork_', () => {
    beforeEach(login);

    it('Clears fields when network goes offline', () => {
      logout();

      expect(ui.model.onlineNetworks.length).toEqual(0);
    });
  });

  describe('Update giving and getting state in UI', () => {
    beforeEach(login);
    afterEach(logout);

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
          .toHaveBeenCalledWith(Constants.SHARING_ICON);
    });

    it('Extension icon doesnt change if you stop giving to 1 of several ' +
        'getters', () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      syncUserAndInstance('userId', 'userName', 'testGetterId2');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');

      // stop giving to only one friend
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      expect((<jasmine.Spy>mockBrowserApi.setIcon).calls.mostRecent().args[0])
          .toEqual(Constants.SHARING_ICON);
    });

    it('Extension icon changes if you stop giving to all getters',
        () => {
      syncUserAndInstance('userId', 'userName', 'testGetterId');
      syncUserAndInstance('userId', 'userName', 'testGetterId2');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');

      // stop giving to both friends
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId');
      updateToHandlerMap[uproxy_core_api.Update.STOP_GIVING_TO_FRIEND]
          .call(ui, 'testGetterId2');
      expect((<jasmine.Spy>mockBrowserApi.setIcon).calls.mostRecent().args[0])
          .toEqual(Constants.DEFAULT_ICON);
    });

    it('Extension icon changes when you start getting access', () => {
      // Right now, the user can only start getting access by clicking the
      // start button, which directly calls ui.startGettingInUiAndConfig
      // if the core.start promise fulfills. (see polymer/instance.ts)
      syncUserAndInstance('userId', 'userName', 'testInstanceId');
      ui.startGettingInUiAndConfig(
          'testInstanceId', { address : 'testAddress' , port : 0 });
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(Constants.GETTING_ICON);
      ui.stoppedGetting({instanceId: null, error: false});
    });

    it('Extension icon changes when you stop getting access', () => {
      syncUserAndInstance('userId', 'userName', 'testGiverId');
      ui.startGettingInUiAndConfig(
          'testGiverId', { address : 'testAddress' , port : 0 });
      ui['instanceGettingAccessFrom_'] = 'testGiverId';
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(Constants.GETTING_ICON);
      updateToHandlerMap[uproxy_core_api.Update.STOP_GETTING_FROM_FRIEND]
          .call(ui, {instanceId: 'testGiverId', error: false});
      expect(mockBrowserApi.setIcon)
          .toHaveBeenCalledWith(Constants.DEFAULT_ICON);
    });

    it('Sharing status updates when you start and stop sharing', () => {
      syncUserAndInstance('userId', 'Alice', 'testInstanceId');
      updateToHandlerMap[uproxy_core_api.Update.START_GIVING_TO_FRIEND]
          .call(ui, 'testInstanceId');
      expect(ui.sharingStatus).toEqual(ui.i18n_t('SHARING_ACCESS_WITH_ONE',
          { name: 'Alice' }));
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
      expect(ui.gettingStatus).toEqual(ui.i18n_t('GETTING_ACCESS_FROM',
          { name: 'Alice' }));
      ui['instanceGettingAccessFrom_'] = null;
      ui['updateGettingStatusBar_']();
      expect(ui.gettingStatus).toEqual(null);
    });
  });  // Update giving and/or getting state in UI
});  // UI.UserInterface
