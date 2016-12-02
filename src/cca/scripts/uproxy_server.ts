import uparams = require('uparams');
import * as cloud_social_provider from '../../lib/cloud/social/provider';
import * as jsurl from 'jsurl';
import * as social from '../../interfaces/social';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

import CoreConnector from '../../generic_ui/scripts/core_connector';
import { AccessCode, Server, ServerRepository } from '../model/server';
import { SocksProxy } from '../model/socks_proxy_server';
import { VpnDevice } from '../model/vpn_device';
import { CloudSocksProxy } from './cloud_socks_proxy_server';

// A local Socks server that provides access to a remote uProxy Cloud server via RTC.
export class UproxyServer implements Server {
  private instancePath: social.InstancePath;

  // Constructs a server that will use the given CoreApi to start the local proxy.
  // It takes the IP address of the uProxy cloud server it will use for Internet access.    
  public constructor(private proxy: SocksProxy,
    private vpnDevice: VpnDevice,
    private remoteIpAddress: string) { }

  public getIpAddress() {
    return this.remoteIpAddress;
  }

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

// Name by which servers are saved to storage.
const SERVERS_STORAGE_KEY = 'servers';

// Type of the object placed, in serialised form, in storage.
type SavedServers = { [id: string]: SavedServer };

// A server as saved to storage.
interface SavedServer {
  cloudTokens?: cloud_social_provider.Invite;
}

// Maintains a persisted set of servers and liases with the core.
export class UproxyServerRepository implements ServerRepository {
  constructor(
    private storage: Storage,
    // Must already be logged into social networks.
    private core: CoreConnector,
    private vpnDevice: VpnDevice) { }

  // Returns an empty list if there is any error
  // loading from storage.
  public getServers() {
    try {
      const servers = this.loadServers() || {};
      console.debug('loaded servers', servers);
      return Promise.all(Object.keys(servers).map((host) => {
        return this.notifyCoreOfServer(servers[host].cloudTokens);
      }));
    } catch (e) {
      console.warn('could not load servers: ' + e.message);
      return Promise.resolve([]);
    }
  }

  // Loads servers from storage, returning null if none are found.
  // Throws if there is a problem loading from storage or
  // deserialising what was loaded.
  private loadServers(): SavedServers {
    try {
      const serversAsJson = this.storage.getItem(SERVERS_STORAGE_KEY);
      try {
        return JSON.parse(serversAsJson);
      } catch (e) {
        throw new Error('could not parse saved servers: ' + e.message);
      }
    } catch (e) {
      throw new Error('could not load from storage: ' + e.message);
    }
  }

  // Saves a server to storage, merging it with any already found there.
  // Returns true if the server was not already in storage.
  private saveServer(cloudTokens: cloud_social_provider.Invite) {
    const savedServers = this.loadServers();
    savedServers[cloudTokens.host] = {
      cloudTokens: cloudTokens
    };
    this.storage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(savedServers));
  }

  public addServer(accessCode: AccessCode) {
    // This is inspired by ui.ts but note that uProxy Air only
    // supports v2 access codes which have just three fields:
    //  - v
    //  - networkName
    //  - networkData
    // TODO: accept only cloud access codes
    const params: social.InviteTokenData = uparams(accessCode);
    if (!(params || params.v ||
      params.networkName || params.networkData)) {
      return Promise.reject(new Error('could not decode URL'));
    }

    let cloudTokens: cloud_social_provider.Invite =
      jsurl.parse(<string>params.networkData);
    if (typeof cloudTokens === 'string' || cloudTokens instanceof String) {
      cloudTokens = JSON.parse(cloudTokens.toString());
    }

    try {
      this.saveServer(cloudTokens);
    } catch (e) {
      console.warn('could not save server', e);
    }

    // TODO: only notify the core when connecting, and delete it afterwards
    return this.notifyCoreOfServer(cloudTokens);
  }

  private notifyCoreOfServer(cloudTokens: cloud_social_provider.Invite) {
    return this.core.acceptInvitation({
      network: {
        name: 'Cloud'
      },
      tokenObj: {
        networkData: cloudTokens,
      }
    }).then(() => {
      let proxy = new CloudSocksProxy(this.core, cloudTokens.host);
      return new UproxyServer(proxy, this.vpnDevice, proxy.getRemoteIpAddress());
    });
  }
}
