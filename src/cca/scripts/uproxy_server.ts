import uparams = require('uparams');
import * as jsurl from 'jsurl';
import * as social from '../../interfaces/social';
import * as cloud_social_provider from '../../lib/cloud/social/provider';

import CoreConnector from '../../generic_ui/scripts/core_connector';
import { AccessCode, OnServerCallback, Server, ServerRepository } from '../model/server';
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
                     private remoteIpAddress: string) {}

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

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
function getIsStorageAvailable() {
  try {
    const storage = window['localStorage'];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch(e) {
    return false;
  }
}
const isStorageAvailable = getIsStorageAvailable();

// Name by which servers are saved to storage.
const CONTACTS_STORAGE_KEY = 'cloud-server-invites';

export class UproxyServerRepository implements ServerRepository {
  // core must already be logged into social networks.
  constructor(private core: CoreConnector, private vpnDevice: VpnDevice) {
    if (!isStorageAvailable) {
      console.warn('localStorage unavailable - contacts will not be saved');
      return;
    }
  }

  public onServerCallback :OnServerCallback;
  public onServer(callback:OnServerCallback) {
    this.onServerCallback = callback;
    return this;
  }

  public restore() {
    if (!this.onServerCallback) {
      throw new Error('must set onServer callback');
    }

    for (const contact of this.loadContacts()) {
      this.informCoreOfServer(contact.invite).then((server) => {
        try {
          this.onServerCallback(server);
        } catch (e) {
          console.warn('onServer callback threw', e);
        }
      }, (e) => {
        console.warn('could not inform core of saved server', e);
      });
    }
  }

  // returns saved contacts as an array, which will be empty if
  // localStorage is unavailable or no contacts are found.
  // throws if there is an error reading from localStorage or
  // the stored contacts could not be parsed.
  private loadContacts(): cloud_social_provider.SavedContact[] {
    if (!isStorageAvailable) {
      return [];
    }

    const savedContactsJson = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!savedContactsJson) {
      return [];
    }

    return (<cloud_social_provider.SavedContacts>JSON.parse(savedContactsJson)).contacts || [];
  }

  // merges a contact with those already saved to storage.
  // contacts are saved as a SavedContacts serialised as JSON. 
  private saveContact(newInvite:cloud_social_provider.Invite) {
    if (!isStorageAvailable) {
      return;
    }

    const savedContacts = this.loadContacts();
    savedContacts.push({
      invite: newInvite
    });
    const contactSet: { [host: string]: cloud_social_provider.SavedContact } = {};
    for (const contact of savedContacts) {
      contactSet[contact.invite.host] = contact;
    }

    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(<cloud_social_provider.SavedContacts>{ 
      contacts: Object.keys(contactSet).map(key => contactSet[key])
    }));
  }

  // TODO: de-dupe entries
  public addServer(inviteUrl:string): Promise<Server> {
    // inspired from ui.ts but uproxy air only supports v2 invites
    // which have just three fields:
    //  - v=2
    //  - networkName=Cloud
    //  - networkData=<jsurl stuff that we send, as an object, to the cloud social provider>
    // TODO: accept only cloud invites
    const params :social.InviteTokenData = uparams(inviteUrl);
    if (!(params || params.v || params.networkName || params.networkData)) {
      return Promise.reject(new Error('could not decode URL'));
    }

    const cloudInvite :cloud_social_provider.Invite = JSON.parse(
        jsurl.parse(<string>params.networkData));

    // save contact immediately so that it is not lost in case
    // something goes wrong calling the core.
    try {
      this.saveContact(cloudInvite);
    } catch (e) {
      console.error('could not save new contact', e);
    }

    return this.informCoreOfServer(cloudInvite);
  }

  private informCoreOfServer = (cloudInvite:cloud_social_provider.Invite) => {
    return this.core.acceptInvitation({
      network: {
        name: 'Cloud'
      },
      tokenObj: {
        networkData: cloudInvite,
      }
    }).then(() => {
      let proxy = new CloudSocksProxy(this.core, cloudInvite.host);
      return new UproxyServer(proxy, this.vpnDevice, proxy.getRemoteIpAddress());
    });
  }
}
