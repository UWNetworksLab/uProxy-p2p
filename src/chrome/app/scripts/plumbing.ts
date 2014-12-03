/**
 * plumbing.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */
/// <reference path='../../../uproxy.ts' />
/// <reference path='../../../freedom/typings/freedom.d.ts' />
/// <reference path='../../util/chrome_glue.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome-app.d.ts'/>

var UPROXY_CHROME_EXTENSION_ID = 'pjpcdnccaekokkkeheolmpkfifcbibnj';

// Remember which handlers freedom has installed.
var installedFreedomHooks = [];
var uProxyAppChannel; // = freedom;   Guaranteed to exist.

// See the ChromeCoreConnector, which communicates to this class.
// TODO: Finish this class with tests and pull into its own file.

class ChromeUIConnector {

  private extPort_:chrome.runtime.Port;    // The port that the extension connects to.
  private onCredentials_ :(Object) => void;

  private INSTALL_INCOMPLETE_PAGE_ :string = '../install-incomplete.html';
  private INSTALL_COMPLETE_PAGE_ :string = '../install-complete.html';
  private installStatusPage_ :string;
  private launchInstallStatusPage_ = () => {
    window.open(this.installStatusPage_);
  }

  constructor() {
    this.extPort_ = null;
    chrome.runtime.onConnectExternal.addListener(this.onConnect_);
    // Until the extension is connected, we assume uProxy installation is
    // incomplete.
    this.installStatusPage_ = this.INSTALL_INCOMPLETE_PAGE_;
    chrome.app.runtime.onLaunched.addListener(this.launchInstallStatusPage_);
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
    this.installStatusPage_ = this.INSTALL_COMPLETE_PAGE_;
    this.extPort_.onDisconnect.addListener(function(){
      // If the extension disconnects, we should show an error
      // page.
      this.installStatusPage_ = this.INSTALL_INCOMPLETE_PAGE_;
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

  public sendToUI = (type :uProxy.Update, data ?:string) => {
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
freedom('scripts/freedom-module.json', {oauth: [Chrome_oauth]}).then(function(interface:any) {
  uProxyAppChannel = interface();
  var connector = new ChromeUIConnector();
  console.log('Starting uProxy app...');
});
