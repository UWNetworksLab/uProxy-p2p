import { VpnDevice } from '../../model/vpn_device';

// A VpnDevice that routes the traffic through a Socks server that is running locally.
class Tun2SocksVpnDevice implements VpnDevice {
  private onDisconnect_: (msg: string) => void;

  public constructor(private tun2socks_: Tun2Socks) {
    this.onDisconnect_ = () => {};
    this.tun2socks_.onDisconnect().then((msg) => {
      this.onDisconnect_(msg);
    });
  }

  // TODO: What's the return string?
  public start(port: number, onDisconnect: (msg: string) => void) : Promise<string> {
    this.onDisconnect_ = onDisconnect;
    // TODO: Is stop() called?
    return this.tun2socks_.start(`127.0.0.1:${port}`);
  }

  // TODO: What's the return string?
  public stop() : Promise<string> {
    return this.tun2socks_.stop();
  }
}

export function GetGlobalTun2SocksVpnDevice(): Promise<VpnDevice> {
  if (!window.tun2socks) {
    return Promise.reject('Device does not support VPN');
  }
  return window.tun2socks.deviceSupportsPlugin().then((supportsVpn) => {
    if (!supportsVpn) {
      throw new Error(`Device does not support VPN`);
    }
    if (!GetGlobalTun2SocksVpnDevice.prototype.device_) {
      GetGlobalTun2SocksVpnDevice.prototype.device_ = new Tun2SocksVpnDevice(window.tun2socks);
    }
    return GetGlobalTun2SocksVpnDevice.prototype.device_;
  });
}