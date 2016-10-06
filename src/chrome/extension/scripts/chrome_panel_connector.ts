/// <reference path='../../../../third_party/typings/index.d.ts'/>

import * as panel_connector from '../../../interfaces/panel_connector';

export class ChromePanelConnector implements panel_connector.BrowserPanelConnector {
  public startListening(
      connectHandler: panel_connector.PanelConnectHandler,
      messageHandler: panel_connector.MessageHandler,
      disconnectHandler: panel_connector.PanelDisconnectHandler) {
    chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
      let panel = new ChromePanel(port, messageHandler, disconnectHandler);
      connectHandler(panel);
    });
  }
}

interface MessageFormat {
  name: string;
  data: Object;
}

class ChromePanel implements panel_connector.Panel {
  private _port: chrome.runtime.Port;

  constructor(
      port: chrome.runtime.Port,
      messageHandler: panel_connector.MessageHandler,
      disconnectHandler: panel_connector.PanelDisconnectHandler) {
    this._port = port;

    this._port.onMessage.addListener((message: MessageFormat) => {
      messageHandler(message.name, message.data);
    });

    this._port.onDisconnect.addListener(() => {
      disconnectHandler(this);
    });
  }

  public sendMessage(name: string, data?: Object) {
    var message: MessageFormat = { name: name, data: data };

    this._port.postMessage(message);
  }
}
