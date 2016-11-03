import uparams = require('uparams');
import * as jsurl from 'jsurl';

import * as net from '../../lib/net/net.types';
import * as social from '../../interfaces/social';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

import CoreConnector from '../../generic_ui/scripts/core_connector';
import { SocksProxyServer } from '../model/socks_proxy_server';


// A local Socks server that provides access to a remote uProxy Cloud server via RTC.
export class CloudSocksProxyServer implements SocksProxyServer {
  private instancePath_: social.InstancePath;

  // Constructs a server that will use the given CoreApi to start the local proxy.
  // It takes the IP address of the uProxy cloud server it will use for Internet access.    
  public constructor(private core_: uproxy_core_api.CoreApi,
                     private remoteIpAddress_: string) {
    this.instancePath_ = {
      network: {
        name: 'Cloud',
        userId: 'me'
      },
      userId: remoteIpAddress_,
      instanceId: remoteIpAddress_
    }
  }

  public remoteIpAddress(): string {
    return this.remoteIpAddress_;
  }

  public start(): Promise<net.Endpoint> {
    console.debug('Starting proxy');
    return this.core_.start(this.instancePath_);
  }

  public stop(): Promise<void> {
    console.debug('Stopping proxy');
    return this.core_.stop(this.instancePath_);
  }
}

function parseInviteUrl(inviteUrl: string): social.InviteTokenData {
  let params = uparams(inviteUrl);
  if (!params || !params['networkName']) {
    return null;
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

export class SocksProxyServerRepository {
  private loginPromise: Promise<uproxy_core_api.LoginResult>;

  constructor(private core_: CoreConnector) {
    this.loginPromise = this.core_.login({
      network: 'Cloud',
      loginType: uproxy_core_api.LoginType.INITIAL,
    });
  }

  public addProxyServer(inviteUrl: string): Promise<CloudSocksProxyServer> {
    let token = parseInviteUrl(inviteUrl);
    if (!token) {
      return Promise.reject(`Failed to parse inviteUrl ${inviteUrl}`);
    }
    // Do I need loginPromise?
    return this.core_.acceptInvitation({
      network: {name: 'Cloud'},
      tokenObj: token
    }).then(() => {
      return new CloudSocksProxyServer(this.core_, (token.networkData as any).host);
    });
  }
}
