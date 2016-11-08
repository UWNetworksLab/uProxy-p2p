import uparams = require('uparams');
import * as jsurl from 'jsurl';

import * as net from '../../lib/net/net.types';
import * as social from '../../interfaces/social';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

import CoreConnector from '../../generic_ui/scripts/core_connector';
import { SocksProxy } from '../model/socks_proxy_server';


// A local Socks server that provides access to a remote uProxy Cloud server via RTC.
export class CloudSocksProxy implements SocksProxy {
  private instancePath: social.InstancePath;

  // Constructs a server that will use the given CoreApi to start the local proxy.
  // It takes the IP address of the uProxy cloud server it will use for Internet access.    
  public constructor(private core: uproxy_core_api.CoreApi,
                     private remoteIpAddress: string) {
    this.instancePath = {
      network: {
        name: 'Cloud',
        userId: 'me'
      },
      userId: remoteIpAddress,
      instanceId: remoteIpAddress
    }
  }

  public getRemoteIpAddress(): string {
    return this.remoteIpAddress;
  }

  public start(): Promise<net.Endpoint> {
    console.debug('Starting proxy');
    return this.core.start(this.instancePath);
  }

  public stop(): Promise<void> {
    console.debug('Stopping proxy');
    return this.core.stop(this.instancePath);
  }
}

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

export class CloudSocksProxyRepository {
  constructor(private core: CoreConnector) {
    this.core.login({
      network: 'Cloud',
      loginType: uproxy_core_api.LoginType.INITIAL,
    });
  }

  public addProxy(inviteUrl: string): Promise<CloudSocksProxy> {
    let token = parseInviteUrl(inviteUrl);
    if (!token) {
      return Promise.reject(`Failed to parse inviteUrl ${inviteUrl}`);
    }
    // TODO: Do I need to wait for core.login()?
    return this.core.acceptInvitation({
      network: {name: 'Cloud'},
      tokenObj: token
    }).then(() => {
      return new CloudSocksProxy(this.core, (token.networkData as any).host);
    });
  }
}
