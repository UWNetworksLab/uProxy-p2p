/*
 * Sends message back to add-on environment, which handles proxy settings.
 * TODO(salomegeo): Figure out if it's possible to set proxy from content script.
 */
/// <reference path='../../../interfaces/firefox.d.ts' />
/// <reference path='../../../interfaces/browser-proxy-config.d.ts'/>

var port :ContentScriptPort;

class BrowserProxyConfig implements IBrowserProxyConfig{
  constructor() {
  }

  public startUsingProxy = (endpoint:Net.Endpoint) => {
    port.emit('startUsingPorxy', endpoint);
  };

  public stopUsingProxy = (askUser :boolean) => {
    port.emit('startUsingPorxy', askUser);
  };
};
