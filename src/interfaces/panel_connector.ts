export interface BackgroundUi {
  fireSignal(signalName: string, data?: Object): void;
}

export type PanelConnectHandler = (panel: Panel) => void;
export type MessageHandler = (name: string, data: Object) => void;
export type PanelDisconnectHandler = (panel: Panel) => void;

/*
 * Connector from the background context to panels
 */
export interface BrowserPanelConnector {
  startListening(
      connectHandler: PanelConnectHandler,
      messageHandler: MessageHandler,
      disconnectHandler: PanelDisconnectHandler): void;
}

/*
 * Individual panel to refer to
 */
export interface Panel {
  sendMessage: MessageHandler;
}

/*
 * Connector in the panel to talk to the background UI
 */
export interface BackgroundUiConnector {
  sendMessage: MessageHandler;
}
