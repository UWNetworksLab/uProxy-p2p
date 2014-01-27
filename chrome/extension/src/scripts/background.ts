/**
 * background.ts
 *
 * This is the background page for the Extension. It maintains a chrome runtime
 * connection with the App, consistent state changes with the UI (see ui.js)
 * and holds the data model for both the popup and options page.
 */
// Assumes that freedom_connector.js has been loaded.
/// <reference path='../common/core.d.ts'/>
/// <reference path="../common/ui/scripts/ui.ts"/>
console.log('Initializing chrome extension background page...');

declare var chrome:any;
declare var jsonpatch:any;
declare var FreedomConnector:any;

class ChromeNotifications implements INotifications {
  ICON_DIR:string = '../common/ui/icons/';
  setIcon(iconFile : string) {
    // TODO: make this not require chrome
    chrome.browserAction.setIcon({
      path: this.ICON_DIR + iconFile
    });
  }
  setLabel(text : string) {
    chrome.browserAction.setBadgeText({ text: '' + text });
  }
  setColor(color) {
    chrome.browserAction.setBadgeBackgroundColor({color: color});
  }
}


// The app connector enables communication between this Extension and the
// corresponding app.
class ChromeAppConnector implements Interfaces.ICore {

  UPROXY_CHROME_APP_ID:string = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';
  appChannel = null;
  // isConnected:boolean = false;

  onConnected() {
    console.warn('No UI yet for onConnected');
  }

  onDisconnected() {
    console.warn('No UI yet for onDisconnected.');
  }

  // When the app connector is created, keep trying to establish a connection to
  // the app.
  constructor() {
    // Need to constantly poll for the connection,
    // because it is possible that the App doesn't even exist.

    // Chrome App Id for UProxy Packaged Chrome App.
    this.appChannel = new FreedomConnector(this.UPROXY_CHROME_APP_ID, {
        name: 'uproxy-extension-to-app-port' });
    this.appChannel.onConnected.addListener(() => {
      init(this.appChannel);
      // this.isConnected = true;
      this.onConnected();
    });
    this._checkAppConnection();
  }

  _checkAppConnection() {
    console.log('Checking the app connection!!!',
                this.appChannel);
    this.appChannel.connect(); // Doesn't do anything if it's already connected.
    setTimeout(()=>{
      this._checkAppConnection
    }, SYNC_TIMEOUT * 5);
  }

  reset() {
    console.log('Resetting.');
    this._send('reset', null);
  }

  sendInstance(clientId) {
    // console.log('Sending instance ID to ' + clientId);
    this._send('send-instance', clientId);
  }

  modifyConsent(instanceId, action) {
    console.log('Modifying consent.', instanceId);
    this._send('instance-trust-change',
      {
        instanceId: instanceId,
        action: action
      }
    );
  }

  start(instanceId) {
    console.log('Starting to proxy through ' + instanceId);
    this._send('start-using-peer-as-proxy-server', instanceId);
  }

  stop(instanceId) {
    console.log('Stopping proxy through ' + instanceId);
    this._send('stop-proxying', instanceId);
  }

  updateDescription(description) {
    console.log('Updating description to ' + description);
    this._send('update-description', description);
  }
  changeOption(option) {
    console.log('Changing option ' + option);
  }

  login(network) {
    this._send('login', network);
  }

  logout(network) {
    this._send('logout', network);
  }

  notificationSeen(userId) {
    this._send('notification-seen', userId);
  }

  // Send message to the connected app.
  _send(msgType, payload) {
    if (!this.appChannel.status.connected) {
      this.appChannel.connect();
    }
    console.log('Sending message.');
    // TODO: factor the freedom connector juice into this file and simplify
    // the baklavaness of this code.
    this.appChannel.emit(msgType, payload);
  }
}

// This singleton is referenced in both options and popup.
// UI object is defined in 'common/ui/scripts/ui.js'.
if (undefined === ui) {
  var ui = new UI(
      new ChromeNotifications(),
      new ChromeAppConnector());
}

// --------------------- Communicating with the App ----------------------------

var _extensionInitialized = false;

// Proxy Configuration.
// TODO: This should be actually typed
var proxyConfig = new window['BrowserProxyConfig']();
proxyConfig.clearConfig();

// ---------------------------- State Changes ----------------------------------
var model:any = {};  // Singleton angularjs model for either popup or options.
var onStateChange = new chrome.Event();

// Rate Limiting for state updates (ms)
var SYNC_TIMEOUT = 800;
var syncBlocked = false;
var syncTimer = null;     // Keep reference to the timer.

// Rate limit synchronizations.
function rateLimitedUpdates() {
  ui.sync();
  checkRunningProxy();
  onStateChange.dispatch();
}

// TODO(): remove this if there's no use for it.
chrome.runtime.onInstalled.addListener(function (details) {
  console.log('onInstalled: previousVersion', details.previousVersion);
});

chrome.runtime.onSuspend.addListener(function () {
  console.log('onSuspend');
  //proxyConfig.stopUsingProxy();
})

// ---------------------------- Initialization ---------------------------------
// Called when appChannel is connected.
function init(appChannel) {

  var finishStateChange = function() {
    // Initiate first sync and start a timer if necessary, in order to
    // rate-limit passes through the entire model & other checks.
    if (!syncBlocked) {
      syncBlocked = true;
      rateLimitedUpdates();
    }
    if (!syncTimer) {
      syncTimer = setTimeout(function() {
        rateLimitedUpdates();
        syncTimer = null;  // Allow future timers.
        syncBlocked = false;
      }, SYNC_TIMEOUT);
    }
  }

  // A full state-refresh should occur whenever the extension first connects to
  // the App, or when the user does a full reset.
  appChannel.on('state-refresh', function(state) {
    // For resetting state, don't nuke |model| with the new object...
    // (there are references to it for Angular) instead, replace keys so the
    // angular $watch can catch up.
    for (var k in model) {
      delete model[k];
    }
    for (var k in state) {
      model[k] = state[k];
    }
    console.log('state-refresh: model = ', model);
    finishStateChange();
  });

  // Normal state-changes should modify some path inside |model|.
  appChannel.on('state-change', function(patchMsg) {
    console.log("state-change(patch: ", patchMsg);
    for (var i in patchMsg) {
      // NEEDS TO BE ADD, BECAUSE THIS IS A HACK :)
      // TODO: verify the path and use replace when appropriate.
      patchMsg[i].op = 'add';
      if ('' == patchMsg[i].path) {
        console.log('WARNING: There should never be a root state-change. \n' +
                    'Use state-refresh');
      }
    }
    jsonpatch.apply(model, patchMsg);
    finishStateChange();
  });

  console.log('UI <------> APP wired.');
  appChannel.emit('ui-ready');  // Tell uproxy.js to send us a state-refresh.
}


function checkRunningProxy() {
  if (model && model['instances']) {
    for (var k in model['instances']) {
      if (model['instances'].hasOwnProperty(k) && model['instances'][k].status &&
          model['instances'][k].status.proxy) {
        if ('running' == model['instances'][k].status.proxy) {
          proxyConfig.startUsingProxy();
          return;
        }
      }
    }
  }
  proxyConfig.stopUsingProxy();
}
