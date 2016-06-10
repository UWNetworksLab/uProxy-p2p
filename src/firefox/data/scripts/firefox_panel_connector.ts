/**
 * In Firefox, we have a very strict singleton way of handling the panel where
 * we can guarantee that only one panel will ever be created and its state will
 * never be altered.  Given that all scripts are running in the same
 * environment, we have an insanely simple way of representing that here
 */
import panel_connector = require('../../../interfaces/panel_connector');

export class FirefoxPanelConnector implements panel_connector.BrowserPanelConnector {
  private connectHandler: panel_connector.PanelConnectHandler;
  private messageHandler: panel_connector.MessageHandler;
  private disconnectHandler: panel_connector.PanelDisconnectHandler;
  private currentPanel: panel_connector.Panel = null;

  public startListening(
      connectHandler: panel_connector.PanelConnectHandler,
      messageHandler: panel_connector.MessageHandler,
      disconnectHandler: panel_connector.PanelDisconnectHandler) {
    this.connectHandler = connectHandler;
    this.messageHandler = messageHandler;
    this.disconnectHandler = disconnectHandler;
  }

  public panelConnect(fn: panel_connector.MessageHandler) {
    if (this.currentPanel) {
      this.disconnectHandler(this.currentPanel);
    }

    this.currentPanel = new DummyPanel(fn);
    this.connectHandler(this.currentPanel);
  }

  public sendMessageFromPanel(name: string, data: Object): void {
    this.messageHandler(name, data);
  }
}

class DummyPanel implements panel_connector.Panel {
  private sendMessageHandler: panel_connector.MessageHandler;

  constructor(sendMessageHandler: panel_connector.MessageHandler) {
    this.sendMessageHandler = sendMessageHandler;
  }

  public sendMessage(name: string, data: Object) {
    return this.sendMessageHandler(name, data);
  }
}
