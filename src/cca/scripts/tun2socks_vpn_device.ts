/// <reference path='../../../third_party/cordova/tun2socks.d.ts'/>

import { VpnDevice } from '../model/vpn_device';

// A VpnDevice that routes the traffic through a Socks server that is running locally.
class Tun2SocksVpnDevice implements VpnDevice {
  private onDisconnect: (msg: string) => void;

  public constructor(private tun2socks: Tun2Socks) {
    this.onDisconnect = () => { };
    this.tun2socks.onDisconnect().then((msg) => {
      this.onDisconnect(msg);
    });
  }

  // TODO: What's the return string?
  public start(port: number, onDisconnect: (msg: string) => void): Promise<string> {
    this.onDisconnect = onDisconnect;
    // TODO: Is stop() called?
    return this.tun2socks.start(`127.0.0.1:${port}`);
  }

  // TODO: What's the return string?
  public stop(): Promise<string> {
    return this.tun2socks.stop();
  }
}

const globalTun2SocksVpnDevice = new Promise((resolve, reject) => {
  // Wait for Cordova plugins to be loaded.
  window.top.document.addEventListener('deviceready', () => {
    if (!window.tun2socks) {
      reject('Device does not support VPN');
      return;
    }
    window.tun2socks.deviceSupportsPlugin().then((supportsVpn) => {
      if (!supportsVpn) {
        reject(`Device does not support VPN`);
        return;
      }
      resolve(new Tun2SocksVpnDevice(window.tun2socks));
    });
  });
});

export function GetGlobalTun2SocksVpnDevice(): Promise<VpnDevice> {
  return globalTun2SocksVpnDevice;
}