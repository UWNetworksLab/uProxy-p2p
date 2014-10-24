/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='ui.ts' />

// TODO: move model, mockCore, and mockBrowserAction to a file
// where they can be re-used.
var model :UI.Model = {
  networks: [
    {
      name: 'testNetwork',
      userId: 'fakeUser',
      online: true,
      roster: {}
    }
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

  beforeEach(() => {
    // Create a fresh UI object before each test.
    var mockCore = jasmine.createSpyObj('core', ['reset', 'onUpdate']);
    mockBrowserAction = jasmine.createSpyObj('browserAction', ['setIcon']);
    ui = new UI.UserInterface(mockCore, mockBrowserAction);
  });

  describe('syncUser', () => {

    it('Adds users to roster and contacts list', () => {
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
          isOnline: true
        },
        instances: [clientInstance, serverInstance]
      };
      ui.syncUser(payload);
      var user :UI.User = model.networks[0].roster['testUserId'];
      expect(user).toBeDefined();
    });

    describe('Update giving and/or getting state in UI', () => {
      var clientInstance :UI.Instance;
      var serverInstance :UI.Instance;

      beforeEach(() => {
        clientInstance = {
          instanceId: 'instance1',
          description: 'description1',
          consent: {
            asClient: Consent.ClientState.GRANTED,
            asProxy: Consent.ProxyState.NONE
          },
          access: {asClient: true, asProxy: false},
          isOnline: true,
          bytesSent: 0,
          bytesReceived: 0
        };    
        serverInstance = {
          instanceId: 'instance1',
          description: 'description1',
          consent: {
            asClient: Consent.ClientState.NONE,
            asProxy: Consent.ProxyState.GRANTED
          },
          access: {asClient: false, asProxy: true},
          isOnline: true,
          bytesSent: 0,
          bytesReceived: 0
        };
        proxyConfig = jasmine.createSpyObj('IBrowserProxyConfig',
            ['startUsingProxy', 'stopUsingProxy']);       
      });

      it('isGivingAccess updates when you start giving', () => {
        var payload :UI.UserMessage = {
          network: 'testNetwork',
          user: {
            userId: 'testUserId',
            name: 'Alice',
            imageData: 'testImageData',
            isOnline: true
          },
          instances: [clientInstance]
        };
        expect(ui.isGivingAccess()).toEqual(false);        
        ui.syncUser(payload);
        expect(ui.isGivingAccess()).toEqual(true);
      });      

      it('isGettingAccess updates when you start getting', () => {
        var payload :UI.UserMessage = {
          network: 'testNetwork',
          user: {
            userId: 'testUserId',
            name: 'Alice',
            imageData: 'testImageData',
            isOnline: true
          },
          instances: [serverInstance]
        };
        expect(ui.isGettingAccess()).toEqual(false);        
        ui.syncUser(payload);
        expect(ui.isGettingAccess()).toEqual(true);
      }); 

      it('Extension icon changes when you give access', () => {
        var payload :UI.UserMessage = {
          network: 'testNetwork',
          user: {
            userId: 'testUserId',
            name: 'Alice',
            imageData: 'testImageData',
            isOnline: true
          },
          instances: [clientInstance]
        };      
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .toHaveBeenCalledWith('uproxy-19-p.png');
      });   

      it('Extension icon doesnt change if only 1 of several clients ' + 
          'disconnects', () => {
        var clientInstance2 = {
          instanceId: 'instance2',
          description: 'description2',
          consent: {
            asClient: Consent.ClientState.GRANTED,
            asProxy: Consent.ProxyState.NONE
          },
          access: {asClient: true, asProxy: false},
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
            isOnline: true
          },
          instances: [clientInstance, clientInstance2]
        };      
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .toHaveBeenCalledWith('uproxy-19-p.png');
        clientInstance.access.asClient = false;
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .not.toHaveBeenCalledWith('uproxy-19.png');
      }); 

      it('Extension icon changes if all clients disconnect', 
          () => {
        var clientInstance2 = {
          instanceId: 'instance2',
          description: 'description2',
          consent: {
            asClient: Consent.ClientState.GRANTED,
            asProxy: Consent.ProxyState.NONE
          },
          access: {asClient: true, asProxy: false},
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
            isOnline: true
          },
          instances: [clientInstance, clientInstance2]
        };      
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .toHaveBeenCalledWith('uproxy-19-p.png');
        clientInstance.access.asClient = false;
        clientInstance2.access.asClient = false;
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .toHaveBeenCalledWith('uproxy-19.png');
      }); 

      it('Extension icon changes when you get access', () => {
        var payload :UI.UserMessage = {
          network: 'testNetwork',
          user: {
            userId: 'testUserId',
            name: 'Alice',
            imageData: 'testImageData',
            isOnline: true
          },
          instances: [serverInstance]
        };      
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .toHaveBeenCalledWith('uproxy-19-c.png');
      });   

      it('Extension icon changes when you stop getting access', () => {
        var payload :UI.UserMessage = {
          network: 'testNetwork',
          user: {
            userId: 'testUserId',
            name: 'Alice',
            imageData: 'testImageData',
            isOnline: true
          },
          instances: [serverInstance]
        };      
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .toHaveBeenCalledWith('uproxy-19-c.png');
        serverInstance.access.asProxy = false;
        ui.syncUser(payload);
        expect(mockBrowserAction.setIcon)
            .toHaveBeenCalledWith('uproxy-19.png');
      });
    }); // Update giving and/or getting state in UI
  }); // syncUser

  // TODO: more specs

});  // UI.UserInterface
