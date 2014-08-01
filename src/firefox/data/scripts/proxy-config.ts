/*
 * Sends message back to add-on environment, which handles proxy settings.
 * TODO(salomegeo): Figure out if it's possible to set proxy from content script.
 */
/// <reference path='../../../interfaces/firefox.d.ts' />

var port :ContentScriptPort;

class BrowserProxyConfig {
  constructor() {
  }

  public startUsingProxy = () => {
    port.emit('startUsingPorxy');
  };

  public stopUsingProxy = () => {
    port.emit('startUsingPorxy');
  };
};
