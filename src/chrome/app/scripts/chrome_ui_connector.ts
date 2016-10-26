import * as browser_connector from '../../../interfaces/browser_connector';
import * as uproxy_core_api from '../../../interfaces/uproxy_core_api';
import * as uproxy_chrome from '../../../interfaces/chrome';

// See the ChromeCoreConnector, which communicates to this class.
// TODO: Finish this class with tests and pull into its own file.
var UPROXY_CHROME_EXTENSION_ID = 'pjpcdnccaekokkkeheolmpkfifcbibnj';
var installedFreedomHooks :number[] = [];

export default class ChromeUIConnector {

  private extPort_:chrome.runtime.Port;    // The port that the extension connects to.
  private onCredentials_ :(credentials?:Object, error?:Object) => void;
  private INSTALL_INCOMPLETE_PAGE_ :string = '../install-incomplete.html';

  constructor(private uProxyAppChannel_ :freedom.OnAndEmit<any,any>) {
    this.extPort_ = null;
    (<chrome.runtime.ExtensionConnectEvent>chrome.runtime.onConnectExternal).addListener(this.onConnect_);
    // Until the extension is connected, we assume uProxy installation is
    // incomplete.
    chrome.app.runtime.onLaunched.addListener(this.launchInstallIncompletePage_);

    chrome.runtime.onUpdateAvailable.addListener((details) => {
      this.sendToCore(uproxy_core_api.Command.HANDLE_CORE_UPDATE,
                      {version: details.version});
    });
  }

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
        type: uproxy_core_api.Update.LAUNCH_UPROXY,
        data: ''
    });
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
    this.extPort_.postMessage(uproxy_chrome.ChromeMessage.ACK);
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
  private onExtMsg_ = (msg :browser_connector.Payload) => {
    console.log('[chrome ui connector] Extension message: ', uproxy_core_api.Command[msg.type]);
    // Pass 'emit's from the UI to Core.
    if ('emit' == msg.cmd) {
      if (msg.type == uproxy_core_api.Command.SEND_CREDENTIALS) {
        this.onCredentials_(msg.data);
      } else if (msg.type == uproxy_core_api.Command.CREDENTIALS_ERROR) {
        this.onCredentials_(undefined, msg.data);
      } else if (msg.type == uproxy_core_api.Command.RESTART) {
        chrome.runtime.reload();
      }
      this.sendToCore(msg.type, msg.data, msg.promiseId);

    // Install onUpdate handlers by request from the UI.
    } else if ('on' == msg.cmd) {
      if (installedFreedomHooks.indexOf(msg.type) >= 0) {
        console.warn('[chrome ui connector] Freedom already has a hook for ' +
            uproxy_core_api.Command[msg.type]);
        return;
      }
      installedFreedomHooks.push(msg.type);
      // When it fires, send data back over Chrome App -> Extension port.
      this.uProxyAppChannel_.on(msg.type.toString(), (ret :string) => {
        this.sendToUI(msg.type, ret);
      });
    }
  }

  public sendToCore = (msgType :uproxy_core_api.Command, data :Object,
                       promiseId :Number = 0) => {
    this.uProxyAppChannel_.emit(msgType.toString(),
                                {data: data, promiseId: promiseId});
  }

  public sendToUI = (type :uproxy_core_api.Update, data?:Object) => {
    if (!this.extPort_) {
      console.error('Trying to send a message without the UI being connected');
      return;
    }

    this.extPort_.postMessage({
        cmd: 'fired',
        type: type,
        data: data
    });
  }

  public setOnCredentials = (onCredentials:(credentials:Object) => void) => {
    this.onCredentials_ = onCredentials;
  }
}
