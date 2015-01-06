/**
 * plumbing.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */
/// <reference path='chrome_oauth.ts' />
/// <reference path='../../../uproxy.ts' />
/// <reference path='../../../freedom/typings/freedom.d.ts' />
/// <reference path='../../util/chrome_glue.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome-app.d.ts'/>

var UPROXY_CHROME_EXTENSION_ID = 'pjpcdnccaekokkkeheolmpkfifcbibnj';

// Remember which handlers freedom has installed.
var installedFreedomHooks = [];
var connector :ChromeUIConnector;
var uProxyAppChannel : OnAndEmit<any,any>;

// See the ChromeCoreConnector, which communicates to this class.
// TODO: Finish this class with tests and pull into its own file.

class ChromeUIConnector {

  private extPort_:chrome.runtime.Port;    // The port that the extension connects to.
  private onCredentials_ :(Object) => void;
  private INSTALL_INCOMPLETE_PAGE_ :string = '../install-incomplete.html';

  // Launch a popup instructing the user to install the extension.
  private launchInstallIncompletePage_ = () => {
    var installIncompletePopup = chrome.app.window.get('install-incomplete');
    if (!installIncompletePopup) {
      chrome.app.window.create(this.INSTALL_INCOMPLETE_PAGE_,
          { id: 'install-extension',
            innerBounds: {
            height: 600,
            width: 371
          }});
    } else {
      installIncompletePopup.focus();
    }
  }

  // If we are connected to the extension, launch uproxy.
  private launchUproxy_ = () => {
    this.extPort_.postMessage({
        cmd: 'fired',
        type: uProxy.Update.LAUNCH_UPROXY,
        data: ''
    });
  }

  constructor() {
    this.extPort_ = null;
    chrome.runtime.onConnectExternal.addListener(this.onConnect_);
    // Until the extension is connected, we assume uProxy installation is
    // incomplete.
    chrome.app.runtime.onLaunched.addListener(this.launchInstallIncompletePage_);
  }

  // Handler for when the uProxy Chrome Extension connects to this uProxy App.
  private onConnect_ = (port :chrome.runtime.Port) => {
    // Security: only allow the official uproxy extension to control the backend.
    // We don't want another extension secretly making you proxy others, or
    // trying to do something even worse.
    if (UPROXY_CHROME_EXTENSION_ID !== port.sender.id ||
        port.name !== 'uproxy-extension-to-app-port') {
      console.warn('Got connect from an unexpected extension id: ' +
          port.sender.id);
      return;
    }
    console.log('Connected to extension ' + UPROXY_CHROME_EXTENSION_ID);
    this.extPort_ = port;  // Update to the current port.

    // Because there is no callback when you call runtime.connect and it
    // sucessfully connects, the extension depends on a message received from
    // this app, so it knows the connection was successful.
    this.extPort_.postMessage(ChromeGlue.ACK);
    this.extPort_.onMessage.addListener(this.onExtMsg_);

    // Once the extension is connected, we know that installation of uProxy
    // is complete.
    chrome.app.runtime.onLaunched.removeListener(this.launchInstallIncompletePage_);
    chrome.app.runtime.onLaunched.addListener(this.launchUproxy_);
    this.extPort_.onDisconnect.addListener(function(){
      // If the extension disconnects, we should show an error
      // page.
      chrome.app.runtime.onLaunched.removeListener(this.launchUproxy_);
      chrome.app.runtime.onLaunched.addListener(this.launchInstallIncompletePage_);
    }.bind(this));
  }

  // Receive a message from the extension.
  // This usually installs freedom handlers.
  private onExtMsg_ = (msg :uProxy.Payload) => {
    console.log('extension message: ', msg);
    var msgType = '' + msg.type;
    // Pass 'emit's from the UI to Core. These are uProxy.Commands.
    if ('emit' == msg.cmd) {
      if (msg.type == uProxy.Command.SEND_CREDENTIALS) {
        this.onCredentials_(msg.data);
      }
      uProxyAppChannel.emit(msgType,
                            <uProxy.PromiseCommand>{data: msg.data, promiseId: msg.promiseId});

    // Install onUpdate handlers by request from the UI.
    } else if ('on' == msg.cmd) {
      if (installedFreedomHooks.indexOf(msg.type) >= 0) {
        console.log('freedom already has a hook for ' + msg.type);
        return;
      }
      installedFreedomHooks.push(msg.type);
      // When it fires, send data back over Chrome App -> Extension port.
      uProxyAppChannel.on(msgType, (ret :string) => {
        this.sendToUI(msg.type, ret);
      });
    }
  }

  public sendToUI = (type :uProxy.Update, data ?:any) => {
    this.extPort_.postMessage({
        cmd: 'fired',
        type: type,
        data: data
    });
  }

  public setOnCredentials = (onCredentials :(Object) => void) => {
    this.onCredentials_ = onCredentials;
  }
}
var uproxyModule = new freedom('scripts/freedom-module.json', {
  oauth: [Chrome_oauth]
}).then(function(UProxy : () => void) {
  uProxyAppChannel = new UProxy();
  connector = new ChromeUIConnector();
  console.log('Starting uProxy app...');
});

chrome.runtime.onMessageExternal.addListener(
    function(request, sender, sendResponse) {
        if (request) {
          sendResponse({message: "Application installed."});
        }
        return true;
    });
