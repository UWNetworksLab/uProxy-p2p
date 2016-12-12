import * as cloud_social_provider from '../../lib/cloud/social/provider';
import * as social from '../../interfaces/social';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';
import CoreConnector from '../../generic_ui/scripts/core_connector'

import { SocksProxy } from '../model/socks_proxy_server';

export function makeCloudSocksProxy(corePromise: Promise<CoreConnector>,
    cloudTokens: cloud_social_provider.Invite): CloudSocksProxy {
  const coreAcceptedPromise = corePromise.then((core) => {
    return core.acceptInvitation({
      network: {
        name: 'Cloud'
      },
      tokenObj: {
        networkData: cloudTokens,
      }
    }).then(() => {
      return core;
    });
  });
  return new CloudSocksProxy(coreAcceptedPromise, cloudTokens.host);
}

// A local Socks server that provides access to a remote uProxy Cloud server via RTC.
export class CloudSocksProxy implements SocksProxy {
  private instancePath: social.InstancePath;

  // Constructs a server that will use the given CoreApi to start the local proxy.
  // It takes the IP address of the uProxy cloud server it will use for Internet access.    
  public constructor(private corePromise: Promise<uproxy_core_api.CoreApi>,
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

  // Returns the IP address of the cloud server this proxy is connecting to.
  public getRemoteIpAddress(): string {
    return this.remoteIpAddress;
  }

  public start(): Promise<number> {
    console.debug('Starting proxy');
    return this.corePromise.then((core) => {
      return core.start(this.instancePath);
    }).then((endpoint) => {
      console.debug(`Local Socks proxy running on port ${endpoint.port}, talking to IP ${this.remoteIpAddress}`);
      return endpoint.port;
    });
  }

  public stop(): Promise<void> {
    console.debug('Stopping proxy');
    return this.corePromise.then((core) => {
      return core.stop(this.instancePath);
    });
  }
}
