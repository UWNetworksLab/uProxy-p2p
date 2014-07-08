/*
 * Configuration and control of the browsers proxy settings.
 */
/// <reference path='../../../interfaces/firefox.d.ts' />

var port :ContentScriptPort;

class BrowserProxyConfig {
  constructor() {
  }

  public startUsingProxy = () => {
    port.emit('startUsingProxy');
  };

  public stopUsingProxy = () => {
    port.emit('stopUsingProxy');
  };
};
