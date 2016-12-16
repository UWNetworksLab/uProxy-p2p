/// <reference path='../types/ssh.d.ts'/>

import { SocksProxy } from '../model/socks_proxy_server';

// A local Socks server that provides access to a remote uProxy Cloud server via SSH.
export class SshSocksProxy implements SocksProxy {

  public constructor(private remoteIpAddress: string, private remotePort: number,
    private username: string, private password: string, private localPort: number) {

  }

  // Returns the IP address of the cloud server this proxy is connecting to.
  public getRemoteIpAddress(): string {
    return this.remoteIpAddress;
  }

  public start(): Promise<number> {
    console.debug('Starting SocksProxy');
    console.debug('Establishing SSH connection');
    return cordova.plugins.SshPlugin.connect(this.remoteIpAddress, this.remotePort,
        this.username, '', this.password).then(() => {
      console.debug(`Connected to SSH server on ${this.remoteIpAddress}:${this.remotePort}`);
      return cordova.plugins.SshPlugin.startProxy(this.localPort);
    }).then(() => {
      console.log(`'Socks proxy running on port ${this.localPort}`);
      return this.localPort;
    });
  }

  public stop(): Promise<void> {
    console.debug('Stopping SocksProxy');
    return cordova.plugins.SshPlugin.stopProxy().then(() => {
      console.debug('Socks proxy stopped.');
      return cordova.plugins.SshPlugin.disconnect();
    });
  }
}
