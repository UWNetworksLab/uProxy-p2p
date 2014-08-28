// Fake dependency which mocks all interactions such that the UI can work.
/// <reference path='../../uproxy.ts' />
/// <reference path='../../interfaces/ui.d.ts'/>
/// <reference path='../../interfaces/browser_action.d.ts'/>
/// <reference path='../../interfaces/lib/angular.d.ts' />
/// <reference path='../../generic_ui/scripts/ui.ts' />

console.log('This is not a real uProxy frontend.');

declare var angular:ng.IAngularStatic;

var model :UI.Model = {
  networks: {},
  // 'global' roster, which is just the concatenation of all network rosters.
  roster: [],
  description: 'My Computer'
};

class MockNotifications implements BrowserAction {
  setIcon(iconFile) {
    console.log('setting icon to ' + iconFile);
  }
}

function generateFakeUserMessage() : UI.UserMessage {
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
        consent: {
          asClient: Consent.ClientState.NONE,
          asProxy:  Consent.ProxyState.NONE
        },
        access: {
          asClient: false,
          asProxy: false
        }
      }
    ]
  }
}

class MockCore implements uProxy.CoreAPI {

  public status :StatusObject;
  private currentProxyServer :UI.CurrentProxy = null;

  constructor() {
    this.status = { connected: true };
  }
  connected = () => {
    return true;  // Static UI core is always 'connected'.
  }
  reset() {
    console.log('Resetting.');
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
      // Find user in model.roster.
      var user :UI.User = null;
      for (var i = 0; i < model.roster.length; ++i) {
        if (model.roster[i].userId == command.userId) {
          user = model.roster[i];
          break;
        }
      }
      if (!user) {
        console.error('Unable to find user ' + command.userId);
      }
      var instance = user.instances[0];
      switch (command.action) {
        case Consent.UserAction.REQUEST:
        case Consent.UserAction.CANCEL_REQUEST:
        case Consent.UserAction.ACCEPT_OFFER:
        case Consent.UserAction.IGNORE_OFFER:
          instance.consent.asProxy = Consent.userActionOnProxyState(
              command.action, instance.consent.asProxy);
          break;
        case Consent.UserAction.OFFER:
        case Consent.UserAction.CANCEL_OFFER:
        case Consent.UserAction.ALLOW_REQUEST:
        case Consent.UserAction.IGNORE_REQUEST:
          instance.consent.asClient = Consent.userActionOnClientState(
              command.action, instance.consent.asClient);
          break;
        default:
          console.warn('Invalid Consent.UserAction! ' + command.action);
          return;
      }
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
          userUpdate.instances[0].consent.asProxy = Consent.ProxyState.GRANTED;
          userUpdate.instances[0].consent.asClient = Consent.ClientState.GRANTED;
          ui.syncUser(userUpdate);
        }, 500);
      }
    }, 10);
  }

  // Fake starting and stopping proxying sessions.
  start = (path) : Promise<void> => {
    console.log('Starting to proxy through ', path);
    var user :UI.User = model.networks[path.network].roster[path.userId];
    this.currentProxyServer = {
      instance: user.instances[0],
      user: user
    };
    console.log(this.currentProxyServer);
    this.currentProxyServer.instance.access.asProxy = true;
    return Promise.resolve();
  }

  stop = () => {
    if (!this.currentProxyServer) {
      console.warn('No proxy to stop for.');
      return;
    }
    console.log('Stopping proxy through ', this.currentProxyServer);
    this.currentProxyServer.instance.access.asProxy = false;
    this.currentProxyServer = null;
  }

  updateDescription(description) {
    console.log('Updating description to ' + description);
  }
  changeOption(option) {
    console.log('Changing option ' + option);
  }
  login = (network) : Promise<void> => {
    console.log('Logging in to', network);
    ui['syncNetwork_']({
      name: 'google',
      online: true
    });
    // Pretend we receive a bunch of user messages.
    ui.syncUser(generateFakeUserMessage());
    return Promise.resolve();
  }
  logout(network) {
    console.log('Logging out of', network);
    ui['syncNetwork_']({
      name: 'google',
      online: false
    });
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
    new MockNotifications());

var dependencyInjector = angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    return function (key) { return key; };
  })
  .constant('ui', ui)
  .constant('model', model)
  .constant('core', mockCore)

// Fake a bunch of interactions from core.
// Starts off being 'offline' to a network.
ui['syncNetwork_'](<UI.NetworkMessage>{
  name: 'google',
  online: false
});

ui['DEBUG'] = true;
