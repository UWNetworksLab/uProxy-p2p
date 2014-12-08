// Fake dependency which mocks all interactions such that the UI can work.
/// <reference path='../../uproxy.ts' />
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../interfaces/browser-api.d.ts'/>
/// <reference path='../../generic_ui/scripts/ui.ts' />
/// <reference path='../../networking-typings/communications.d.ts' />

console.log('This is not a real uProxy frontend.');

var model :UI.Model = {
  networkNames: [],
  onlineNetwork: null,
  contacts: {
    'getAccessContacts' : {
      'onlinePending': [],
      'offlinePending': [],
      'onlineTrustedUproxy': [],
      'offlineTrustedUproxy': [],
      'onlineUntrustedUproxy': [],
      'offlineUntrustedUproxy': [],
      'onlineNonUproxy': [],
      'offlineNonUproxy': []
    },
    'shareAccessContacts' : {
      'onlinePending': [],
      'offlinePending': [],
      'onlineTrustedUproxy': [],
      'offlineTrustedUproxy': [],
      'onlineUntrustedUproxy': [],
      'offlineUntrustedUproxy': [],
      'onlineNonUproxy': [],
      'offlineNonUproxy': []
    }
  },
  globalSettings: {}
};

class MockBrowserApi implements BrowserAPI {
  setIcon(iconFile) {
    console.log('setting icon to ' + iconFile);
  }
  startUsingProxy() {}
  stopUsingProxy(askUser) {}
  openFaq(pageAnchor) {}
}

function generateFakeUserMessage() :UI.UserMessage {
  return {
    network: 'google',
    user: {
      userId: 'alice',
      name: 'Alice uProxy',
      timestamp: Date.now(),
      isOnline: true
    },
    instances: [
      {
        instanceId: 'alice-instance-01',
        description: 'fake instance for alice',
        isOnline: true,
        consent: new Consent.State(),
        access: {
          asClient: false,
          asProxy: false
        },
        bytesSent: 0,
        bytesReceived: 0
      }
    ]
  }
}

class MockCore implements uProxy.CoreAPI {

  public status :StatusObject;

  constructor() {
    this.status = { connected: true };
  }
  connected = () => {
    return true;  // Static UI core is always 'connected'.
  }
  sendInstance(clientId) {
    console.log('Sending instance ID to ' + clientId);
  }
  modifyConsent(command) {
    // Delay the actual core interaction to mimic the async nature. Also, to
    // make this occur outside the angular context, ensuring that DOM refreshing
    // from external callbacks works.
    setTimeout(() => {
      // Fake the core interaction, assume it sent bits on the wire, and receive
      // the update from core.
      var userUpdate = generateFakeUserMessage();
      var user :UI.User = null;
      // Find user in model.contacts.
      for (var category in model.contacts) {
        for (var i = 0; i < model.contacts[category].length; ++i) {
          if (model.contacts[category][i].userId == command.userId) {
            user = model.contacts[category][i];
            break;
          }
        }
      }
      if (!user) {
        console.error('Unable to find user ' + command.userId);
      }
      var instance = user.instances[0];
      Consent.handleUserAction(instance.consent, command.action);
      userUpdate.instances[0].consent = instance.consent;
      ui.syncUser(userUpdate);
      console.log('Modified consent: ', command,
                  'new state: ', instance.consent);
      // Make a choice that depends on the time the call was made; a 1 second
      // gap is easy for user to interactively to hit to toggle state. CONSIDER:
      // base it on a hash of the user id? Better to have deterministic
      // behaviour. TODO: Make two UIs side-by-side for an actual 'peer-to-peer'
      // mock.
      if ((new Date()).getSeconds() > 0.5) {
        console.log('Alice will respond...');
        setTimeout(() => {
          userUpdate.instances[0].consent.remoteGrantsAccessToLocal = true;
          userUpdate.instances[0].consent.localGrantsAccessToRemote = true;
          ui.syncUser(userUpdate);
        }, 500);
      }
    }, 10);
  }

  // Fake starting and stopping proxying sessions.
  start = (path) :Promise<Net.Endpoint> => {
    console.log('Starting to proxy through ', path);
    // start() will typically dynamically select a port for communication
    // but for the purpose of this mock, we can choose arbitrary values.
    return Promise.resolve<Net.Endpoint>({
          address: '127.0.0.1',
          port: 24680
      });
  }

  stop = () => {
  }

  updateGlobalSettings(newGlobalSettings) {
    console.log('Updating global settings to '
        + JSON.stringify(newGlobalSettings));
  }

  changeOption(option) {
    console.log('Changing option ' + option);
  }
  login = (network) :Promise<void> => {
    console.log('Logging in to', network);
    ui['syncNetwork_']({
      name: 'google',
      online: true
    });
    // Pretend we receive a bunch of user messages.
    ui.syncUser(generateFakeUserMessage());
    return Promise.resolve<void>();
  }
  logout = (network) :Promise<void> => {
    console.log('Logging out of', network);
    ui['syncNetwork_']({
      name: 'google',
      online: false
    });
    return Promise.resolve<void>();
  }
  onUpdate(update, handler) {
    // In the 'real uProxy', this is where the UI installs update handlers for
    // events received from the Core. Since this is a standalone UI, there is
    // only a mock core, and all interaction is fake beyond this point.
  }
}

var mockCore = new MockCore();
var ui :uProxy.UIAPI = new UI.UserInterface(
    mockCore,
    new MockBrowserApi());

var core = mockCore;

// Fake a bunch of interactions from core.
// Starts off being 'offline' to a network.
ui['syncNetwork_'](<UI.NetworkMessage>{
  name: 'google',
  online: false,
  userId: ''
});
