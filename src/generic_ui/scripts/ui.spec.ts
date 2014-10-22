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

  beforeEach(() => {
    // Create a fresh UI object before each test.
    var mockCore = jasmine.createSpyObj('core', ['reset', 'onUpdate']);
    mockBrowserAction = jasmine.createSpyObj('browserAction', ['setIcon']);
    ui = new UI.UserInterface(mockCore, mockBrowserAction);
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

    describe('Update giving and/or getting state in UI', () => {

      beforeEach(() => {
        proxyConfig = jasmine.createSpyObj('IBrowserProxyConfig',
            ['startUsingProxy', 'stopUsingProxy']);       
      });

      it('isGivingAccess updates when you start giving', () => {
        expect(ui.isGivingAccess()).toEqual(false);   
        ui.instancesGivingAccessTo['testGetterInstanceId'] = true;
        expect(ui.isGivingAccess()).toEqual(true);
      });      

      it('isGettingAccess updates when you start getting', () => {
        expect(ui.isGettingAccess()).toEqual(false);        
        ui.instanceGettingAccessFrom = 'testGiverInstanceId';
        expect(ui.isGettingAccess()).toEqual(true);
      }); 

      it('Extension icon changes when you start giving access', () => {
        // TODO (lucyhe): finish this test.
        //expect(mockBrowserAction.setIcon)
        //    .toHaveBeenCalledWith('uproxy-19-p.png');
      });   

      it('Extension icon doesnt change if you stop giving to 1 of several ' +
          'getters', () => {
        // expect(mockBrowserAction.setIcon)
        //    .toHaveBeenCalledWith('uproxy-19-p.png');
        // TODO (lucyhe): finish this test.     
        // expect(mockBrowserAction.setIcon)
        //    .not.toHaveBeenCalledWith('uproxy-19.png');
      }); 

      it('Extension icon changes if you stop giving to all getters', 
          () => {
        // expect(mockBrowserAction.setIcon)
        //    .toHaveBeenCalledWith('uproxy-19-p.png');
        // TODO (lucyhe): finish this test.     
        // expect(mockBrowserAction.setIcon)
        //    .toHaveBeenCalledWith('uproxy-19.png');
      }); 

      it('Extension icon changes when you start getting access', () => {
        // TODO (lucyhe): finish this test.
        // expect(mockBrowserAction.setIcon)
        //    .toHaveBeenCalledWith('uproxy-19-c.png');
      });   

      it('Extension icon changes when you stop getting access', () => {
        // expect(mockBrowserAction.setIcon)
        //    .toHaveBeenCalledWith('uproxy-19-c.png');
        // TODO (lucyhe): finish this test.     
        // expect(mockBrowserAction.setIcon)
        //    .toHaveBeenCalledWith('uproxy-19.png');
      });
    }); // Update giving and/or getting state in UI
  }); // syncUser

  // TODO: more specs

});  // UI.UserInterface
