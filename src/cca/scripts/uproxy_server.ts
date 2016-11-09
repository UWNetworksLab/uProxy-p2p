import uparams = require('uparams');
import * as jsurl from 'jsurl';
import * as social from '../../interfaces/social';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

import CoreConnector from '../../generic_ui/scripts/core_connector';
import { AccessCode, Server, ServerRepository } from '../model/server';
import { SocksProxy } from '../model/socks_proxy_server';
import { VpnDevice } from '../model/vpn_device';
import { CloudSocksProxy } from './cloud_socks_proxy_server';

function parseInviteUrl(inviteUrl: string): social.InviteTokenData {
  let params = uparams(inviteUrl);
  if (!params || !params['networkName']) {
    throw new Error(`networkName not found: ${inviteUrl}`);
  }
  var permission: any;
  if (params['permission']) {
    permission = jsurl.parse(params['permission']);
  }
  return {
    v: parseInt(params['v'], 10),
    networkData: JSON.parse(jsurl.parse(params['networkData'])),
    networkName: params['networkName'],
    userName: params['userName'],
    permission: permission,
    userId: params['userId'],  // undefined if no permission
    instanceId: params['instanceId'],  // undefined if no permission
  }
}

// A local Socks server that provides access to a remote uProxy Cloud server via RTC.
export class UproxyServer implements Server {
  private instancePath: social.InstancePath;

  // Constructs a server that will use the given CoreApi to start the local proxy.
  // It takes the IP address of the uProxy cloud server it will use for Internet access.    
  public constructor(private proxy: SocksProxy,
                     private vpnDevice: VpnDevice) {}

  public connect(onDisconnect: (msg: string) => void): Promise<void> {
    console.debug('Connecting to server');
    return this.proxy.start().then((port) => {
      this.vpnDevice.start(port, onDisconnect);
    });
  }

  public disconnect(): Promise<void> {
    console.debug('Disconnecting from server');
    return Promise.all([this.proxy.stop(), this.vpnDevice.stop()]);
  }
}

export class UproxyServerRepository implements ServerRepository {
  constructor(private core: CoreConnector, private vpnDevice: VpnDevice) {
    this.core.login({
      network: 'Cloud',
      loginType: uproxy_core_api.LoginType.INITIAL,
    });
  }

  public addServer(code: AccessCode): Promise<Server> {
    let token = parseInviteUrl(code);
    if (!token) {
      return Promise.reject(`Failed to parse access code: ${code}`);
    }
    // TODO: Do I need to wait for core.login()?
    return this.core.acceptInvitation({
      network: {name: 'Cloud'},
      tokenObj: token
    }).then(() => {
      let proxy = new CloudSocksProxy(this.core, (token.networkData as any).host);
      return new UproxyServer(proxy, this.vpnDevice);
    });
  }
}
