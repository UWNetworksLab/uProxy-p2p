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

  beforeEach(() => {
    // Create a fresh UI object before each test.
    var mockCore = jasmine.createSpyObj('core', ['reset', 'onUpdate']);
    var mockBrowserAction = jasmine.createSpyObj('browserAction', ['setIcon']);
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
  }); // syncUser

  // TODO: more specs

});  // UI.UserInterface
