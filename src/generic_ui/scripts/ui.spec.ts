/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='ui.ts' />

// TODO: move model, mockCore, and mockBrowserAction to a file
// where they can be re-used.
var model :UI.Model = {
  networks: [
    {
      name: 'testNetwork',
      online: true,
      roster: {}
    }
  ],
  roster: [],
  description: ''
};

describe('UI.UserInterface', () => {

  var ui :UI.UserInterface;
  var mockBrowserAction;
  var updateToHandlerMap = {};

  beforeEach(() => {
    // Create a fresh UI object before each test.
    var mockCore = jasmine.createSpyObj('core', ['reset', 'onUpdate']);
    mockBrowserAction = jasmine.createSpyObj('browserAction', ['setIcon']);
    ui = new UI.UserInterface(mockCore, mockBrowserAction);

    // Store all the handlers for Updates from core in a map.
    // These functions will be called directly from tests
    // instead of being triggered by events emitted from the core.
    var argumentsForOnUpdate = mockCore.onUpdate.calls.allArgs();
    for (var i = 0; i < argumentsForOnUpdate.length; i++) {
      updateToHandlerMap[argumentsForOnUpdate[i][0]] = argumentsForOnUpdate[i][1];
    }
  });

  describe('syncUser', () => {

    it('Adds users to roster', () => {

      var payload :UI.UserMessage = {
        network: 'testNetwork',
        user: {
          userId: 'testUserId',
          name: 'Alice',
          imageData: 'testImageData',
        },
        instances: []
      };
      ui.syncUser(payload);
      var user :UI.User = model.roster[0];
      expect(user).toBeDefined();
      expect(model.networks[0].roster['testUserId']).toEqual(user);
    });

    it('Sets correct flags for non-uProxy users', () => {
      var payload :UI.UserMessage = {
        network: 'testNetwork',
        user: {
          userId: 'testUserId',
          name: 'Alice',
          imageData: 'testImageData',
        },
        instances: []
      };
      ui.syncUser(payload);
      var user :UI.User = model.networks[0].roster['testUserId'];
      expect(user).toBeDefined();
    });

    it('Sets correct flags for uProxy users', () => {
      var clientInstance :UI.Instance = {
        instanceId: 'instance1',
        description: 'description1',
        consent: {
          asClient: Consent.ClientState.GRANTED,
          asProxy: Consent.ProxyState.NONE
        },
        access: {asClient: false, asProxy: false},
        isOnline: true,
        bytesSent: 0,
        bytesReceived: 0
      };
      var serverInstance :UI.Instance = {
        instanceId: 'instance1',
        description: 'description1',
        consent: {
          asClient: Consent.ClientState.NONE,
          asProxy: Consent.ProxyState.GRANTED
        },
        access: {asClient: false, asProxy: false},
        isOnline: true,
        bytesSent: 0,
        bytesReceived: 0
      };
      var payload :UI.UserMessage = {
        network: 'testNetwork',
        user: {
          userId: 'testUserId',
          name: 'Alice',
          imageData: 'testImageData',
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
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND].call(ui, 'testGetterId');
      expect(ui.isGivingAccess()).toEqual(true);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND].call(ui, 'testGetterId');
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
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND].call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-p.png');
    });   

    it('Extension icon doesnt change if you stop giving to 1 of several ' +
        'getters', () => {
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND].call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-p.png');
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);    
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND].call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND].call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .not.toHaveBeenCalledWith('uproxy-19.png');
    }); 

    it('Extension icon changes if you stop giving to all getters', 
        () => {
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND].call(ui, 'testGetterId');
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-p.png');
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);    
      updateToHandlerMap[uProxy.Update.START_GIVING_TO_FRIEND].call(ui, 'testGetterId2');
      // The icon should not be reset if it's already displaying the correct
      // icon.
      expect(mockBrowserAction.setIcon.calls.count()).toEqual(1);
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND].call(ui, 'testGetterId');
      updateToHandlerMap[uProxy.Update.STOP_GIVING_TO_FRIEND].call(ui, 'testGetterId2');        
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
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19-c.png');
      updateToHandlerMap[uProxy.Update.STOP_GETTING_FROM_FRIEND].call(ui);
      expect(mockBrowserAction.setIcon)
          .toHaveBeenCalledWith('uproxy-19.png');
    });
  });  // Update giving and/or getting state in UI
  // TODO: more specs
});  // UI.UserInterface
