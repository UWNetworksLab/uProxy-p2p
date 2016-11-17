import * as _ from 'lodash';
import uparams = require('uparams');
import * as cloud_social_provider from '../../lib/cloud/social/provider';
import * as jsurl from 'jsurl';
import * as social from '../../interfaces/social';
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
      throw new Error('must call onServer first');
    }

    for (const savedContact of this.loadContacts().contacts) {
      this.informCoreOfServer(savedContact.invite).then((server) => {
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

  // returns saved contacts, which will be empty if
  // localStorage is unavailable or no contacts are found.
  // throws if there is an error reading from localStorage or
  // the stored contacts could not be parsed.
  private loadContacts(): cloud_social_provider.SavedContacts {
    if (!isStorageAvailable) {
      return {
        contacts: []
      };
    }

    const savedContactsJson = localStorage.getItem(CONTACTS_STORAGE_KEY);
    return savedContactsJson ? <cloud_social_provider.SavedContacts>JSON.parse(
        savedContactsJson) : {
      contacts: []
    };
  }

  // merges a contact with those already saved to storage.
  // returns true if the contact was not previously in storage.
  // contacts are saved as a SavedContacts serialised as JSON. 
  private saveContact(newInvite:cloud_social_provider.Invite) {
    if (!isStorageAvailable) {
      return true;
    }

    const savedContacts = this.loadContacts();

    // merge or append, as necessary.
    const dupeIndex = _.findIndex(savedContacts.contacts, (savedContact) => {
      return savedContact.invite && savedContact.invite.host === newInvite.host;
    });

    const newSavedContact: cloud_social_provider.SavedContact = {
      invite: newInvite
    };
    if (dupeIndex > -1) {
      savedContacts.contacts[dupeIndex] = newSavedContact;
    } else {
      savedContacts.contacts.push(newSavedContact);
    }

    // and save!
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(savedContacts));

    return dupeIndex === -1;
  }

  public addServer(inviteUrl:string): Promise<void> {
    if (!this.onServerCallback) {
      throw new Error('must call onServer first');
    }

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

    // inform the core of this new or updated server and, if it's new,
    // emit an onServer event.
    return this.informCoreOfServer(cloudInvite).then((server) => {
      if (this.saveContact(cloudInvite)) {
        try {
          this.onServerCallback(server);
        } catch (e) {
          console.warn('onServer callback threw', e);
        }
      }
    });
  }

  private informCoreOfServer(cloudInvite:cloud_social_provider.Invite) {
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
