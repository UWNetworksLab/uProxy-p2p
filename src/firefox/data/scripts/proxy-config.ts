/*
 * Configuration and control of the browsers proxy settings.
 */
/// <reference path='../../../interfaces/firefox.d.ts' />

var port :ContentScriptPort;

class ProxyConfigForward {
  constructor() {
  }

  public startUsingProxy = () => {
    port.emit('startUsingPorxy');
  };

  public stopUsingProxy = () => {
    port.emit('startUsingPorxy');
  };
};
