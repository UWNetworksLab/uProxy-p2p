/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />
/// <reference path='../../../../third_party/typings/node/node.d.ts' />
/// <reference path='../../../../third_party/typings/ssh2/ssh2.d.ts' />

import logging = require('../../logging/logging');

// https://github.com/borisyankov/DefinitelyTyped/blob/master/ssh2/ssh2-tests.ts
import * as ssh2 from 'ssh2';
var Client = require('ssh2').Client;

var log: logging.Log = new logging.Log('cloud social');

const SSH_SERVER_PORT = 5000;
const SSH_SERVER_USERNAME = 'giver';
const SSH_SERVER_PASSWORD = 'giver';

const ZORK_HOST = 'zork';
const ZORK_PORT = 9000;

// Key under which our contacts are saved in storage.
const STORAGE_KEY = 'cloud-social-contacts';

// Type of the object placed, in serialised form, in storage
// under STORAGE_KEY.
interface SavedContacts {
  addresses?: string[];
}

// Returns a VersionedPeerMessage, as defined in interfaces/social.ts
// in the uProxy repo.
//
// type is a PeerMessageType value (also defined in that file) and
// payload is an arbitrary payload, e.g. an instance message.
// TODO: use typings from the uProxy repo
function makeVersionedPeerMessage(
    type:number,
    payload:Object) : any {
  return {
    type: type,
    data: payload,
    // TODO: remote-instance assumes client versions >= 5 can do PGP, yuck
    version: 4
  };
}

// Returns an InstanceHandshake, as defined in interfaces/social.ts
// in the uProxy repo.
//
// publicKey is deliberately omitted so that uProxy will consider us
// an older client without PGP support and will avoid encrypting
// signalling messages (unnecessary because we are forwarding all the
// messages over an SSH tunnel).
// TODO: use typings from the uProxy repo
function makeInstanceMessage(address:string): any {
  return {
    instanceId: address,
    // Shown in the contacts list while the user's list item is expanded
    // TODO: show machine details, e.g. Linux (via uname)
    description: address,
    consent: {
      isRequesting: false,
      isOffering: true
    },
    name: address,
    userId: address
  };
}

// To see how these fields are handled, see
// generic_core/social.ts#handleClient in the uProxy repo.
function makeClientState(address: string): freedom.Social.ClientState {
  return {
    userId: address,
    clientId: address,
    // https://github.com/freedomjs/freedom/blob/master/interface/social.json
    status: 'ONLINE',
    timestamp: Date.now()
  };
}

// To see how these fields are handled, see
// generic_core/social.ts#handleUserProfile in the uProxy repo. We omit
// the status field since remote-user.ts#update will use FRIEND as a default.
function makeUserProfile(address: string): freedom.Social.UserProfile {
  return {
    userId: address,
    name: address
  };
}

// Exposes Zork instances as friends.
//
// Intended for use with the run_cloud.sh script in the uproxy-docker
// repo, which will spin up the expected configuration:
//  - an SSH server running on port 5000, with an account named
//    "giver" having the password "giver"
//  - a Zork instance, accessible from the SSH server at the
//    hostname "zork"
//
// Note that since there's no actual uProxy instance running on the
// cloud instance, we are forced to re-implement some of uProxy's
// social code here, namely:
//  - we must send a "fake" INSTANCE message in order for uProxy
//    to consider the cloud instance online
//  - we have to inspect, wrap, and unwrap messages coming back and
//    forth since Zork has its own protocol
//
// Additionally, contacts are saved to storage so that we can contact
// them on login and emit a fake instance message for them, making
// them appear online.
//
// TODO: key-based authentication
// TODO: move the social message parsing stuff into Zork
export class CloudSocialProvider {
  // SSH connections.
  // TODO: what is a legal client ID?
  private clients_: { [clientId: string]: Promise<Connection> } = {};

  private storage_: freedom.Storage.Storage = freedom['core.storage']();

  private savedAddresses_: string[] = [];

  constructor(private dispatchEvent_: (name: string, args: Object) => void) {}

  // Emits UserProfile and Instance messages, causing uProxy to make
  // the friend appear online.
  private notifyOfUser_ = (address: string) => {
    this.dispatchEvent_('onUserProfile', makeUserProfile(address));
    this.dispatchEvent_('onMessage', {
      from: makeClientState(address),
      // INSTANCE
      message: JSON.stringify(makeVersionedPeerMessage(
        3000, makeInstanceMessage(address)))
    });
  }

  // Establishes an SSH connection to a server, first shutting down
  // any that previously exists.
  private reconnect_ = (address: string): Promise<Connection> => {
    log.debug('reconnecting to %1', address);
    if (address in this.clients_) {
      log.debug('closing old connection to %1', address);
      this.clients_[address].then((connection: Connection) => {
        connection.close();
      });
    }

    var connection = new Connection(address, (message: Object) => {
      this.dispatchEvent_('onMessage', {
        from: makeClientState(address),
        // SIGNAL_FROM_SERVER_PEER,
        message: JSON.stringify(makeVersionedPeerMessage(3002, message))
      });
    });

    this.clients_[address] = connection.connect().then(() => {
      log.info('connected to zork on %1', address);

      if (this.savedAddresses_.indexOf(address) === -1) {
        this.savedAddresses_.push(address);
        this.saveContacts_();
      }

      return connection;
    });

    return this.clients_[address];
  }

  // Loads contacts from storage and emits an instance message for each.
  // This makes all of the stored contacts appear online.
  private loadContacts_ = () => {
    log.debug('loadContacts');
    this.storage_.get(STORAGE_KEY).then((v: string) => {
      if (!v) {
        log.debug('no saved contacts');
        return;
      }
      log.debug('loaded contacts: %1', v);
      try {
        var savedContacts: SavedContacts = JSON.parse(v);
        // Dumb attempt to prevent dupes, in lieu of Set.
        for (let address of savedContacts.addresses) {
          if (this.savedAddresses_.indexOf(address) === -1) {
            this.savedAddresses_.push(address);
            this.notifyOfUser_(address);
          }
        }
      } catch (e) {
        log.error('could not parse saved contacts: %1', e.message);
      }
    }, (e: Error) => {
      log.error('could not load contacts: %1', e);
    });
  }

  // Saves contacts to storage.
  private saveContacts_ = () => {
    log.debug('saveContacts');
    this.storage_.set(STORAGE_KEY, JSON.stringify(<SavedContacts>{
      addresses: this.savedAddresses_
    })).then((unused: string) => {
      log.debug('saved contacts');
    }, (e: Error) => {
      log.error('could not save contacts: %1', e);
    });
  }

  public login = (options: freedom.Social.LoginRequest):
      Promise<freedom.Social.ClientState> => {
    log.debug('login: %1', options);
    this.loadContacts_();
    // TODO: base this on the user's public key?
    //       (shown in the "connected accounts" page)
    return Promise.resolve(makeClientState('me'));
  }

  public sendMessage = (destinationClientId: string, message: string): Promise<void> => {
    log.debug('sendMessage to %1: %2', destinationClientId, message);
    try {
      // Messages are serialised VersionedPeerMessages. We need to extract
      // the signalling message, which is all Zork understands.
      var versionedPeerMessage: any = JSON.parse(message);
      if (versionedPeerMessage.type &&
          versionedPeerMessage.type === 3001 && // social.PeerMessageType.SIGNAL_FROM_CLIENT_PEER
          versionedPeerMessage.data) {
        // payload is either an instance of social.ts#SignallingMetadata
        // or is an opaque object we should forward to Zork.
        var payload = versionedPeerMessage.data;
        if (payload.proxyingId) {
          // Reset the SSH connection because Zork only supports one
          // proxyng session per connection.
          log.info('new proxying session %1', payload.proxyingId);
          if (!(destinationClientId in this.clients_)) {
            log.info('no previous connection to client %1', destinationClientId);
          }
          return this.reconnect_(destinationClientId).then(
              (connection: Connection) => {
            connection.sendMessage('give');
          });
        } else {
          if (destinationClientId in this.clients_) {
            return this.clients_[destinationClientId].then(
                (connection: Connection) => {
              connection.sendMessage(JSON.stringify(payload));
            });
          } else {
            return Promise.reject('unknown client ' + destinationClientId);
          }
        }
      } else {
        return Promise.reject('message has no or wrong type field');
      }
    } catch (e) {
      return Promise.reject('could not de-serialise message: ' + e.message);
    }
  }

  public clearCachedCredentials = (): Promise<void> => {
    log.warn('clearCachedCredentials');
    return Promise.resolve<void>();
  }

  public getUsers = (): Promise<freedom.Social.Users> => {
    log.warn('getUsers');
    return Promise.resolve();
  }

  public getClients = (): Promise<freedom.Social.Clients> => {
    log.warn('getClients');
    return Promise.resolve();
  }

  public logout = (): Promise<void> => {
    log.warn('logout');
    return Promise.resolve<void>();
  }

  ////
  // social2
  ////

  public inviteUser = (address: string): Promise<Object> => {
    log.debug('inviteUser %1', address);
    return this.reconnect_(address).then(() => {
      this.notifyOfUser_(address);
      // TODO: what should i return?
      return Promise.resolve({
        networkData: '{}'
      });
    });
  }

  public acceptUserInvitation = (userId: string): Promise<void> => {
    log.warn('acceptUserInvitation: %1', userId);
    return Promise.resolve<void>();
  }

  public blockUser = (userId: string): Promise<void> => {
    log.warn('blockUser %1', userId);
    return Promise.resolve<void>();
  }

  public removeUser = (userId: string): Promise<void> => {
    log.warn('removeUser %1', userId);
    return Promise.resolve<void>();
  }
}

enum ConnectionState {
  NEW,
  CONNECTING,
  ESTABLISHING_TUNNEL,
  WAITING_FOR_PING,
  ESTABLISHED,
  TERMINATED
}

class Connection {
  // Number of instances created, for logging purposes.
  private static id_ = 0;

  private state_ = ConnectionState.NEW;

  private client_ = new Client();

  // The tunneled connection, i.e. secure link to Zork.
  private stream_ :ssh2.Channel;

  constructor(
      private address_: string,
      private send_: (message:Object) => void,
      private name_: string = 'tunnel' + Connection.id_++) {}

  // TODO: timeout
  public connect = (): Promise<void> => {
    if (this.state_ !== ConnectionState.NEW) {
      return Promise.reject('can only connect in NEW state');
    }
    this.state_ = ConnectionState.CONNECTING;

    return new Promise<void>((F, R) => {
      this.client_.on('ready', () => {
        this.setState_(ConnectionState.ESTABLISHING_TUNNEL);
        this.client_.forwardOut(
          // TODO: since we communicate using the stream, what does this mean?
          '127.0.0.1', 0,
          ZORK_HOST, ZORK_PORT, (e: Error, stream: ssh2.Channel) => {
            if (e) {
              log.warn('%1: error establishing tunnel: %2',
                  this.name_, e.toString());
              this.close();
              throw e;
            }
            this.setState_(ConnectionState.WAITING_FOR_PING);

            this.stream_ = stream;

            // TODO: add error handler for stream
            this.stream_.on('data', (data: Buffer) => {
              var reply = data.toString().trim();
              switch (this.state_) {
                case ConnectionState.WAITING_FOR_PING:
                  if (reply === 'ping') {
                    this.setState_(ConnectionState.ESTABLISHED);
                    F();
                  } else {
                    this.close();
                    R(new Error('did not receive ping from server on login: ' +
                        reply));
                  }
                  break;
                case ConnectionState.ESTABLISHED:
                  try {
                    this.send_(JSON.parse(reply));
                  } catch (e) {
                    log.warn('%1: could not de-serialise signalling message: %2',
                        this.address_, reply);
                  }
                  break;
                default:
                  log.warn('%1: did not expect message in state %2: %3',
                      this.name_, ConnectionState[this.state_], reply);
                  this.close();
              }
            }).on('error', (e: Error) => {
              // This occurs when:
              //  - host cannot be reached, e.g. non-existant hostname
              // TODO: does this occur outside of startup, i.e. should it always reject?
              log.warn('%1: tunnel error: %2', this.name_, e);
              this.close();
              R(new Error('could not establish tunnel: ' + e.toString()));
            }).on('end', () => {
              // Occurs when the stream is "over" for any reason, including
              // failed connection.
              log.debug('%1: tunnel end', this.name_);
              this.close();
            }).on('close', (hadError: boolean) => {
              // TODO: when does this occur? don't see it on normal close or failure
              log.debug('%1: tunnel close: %2', this.name_, hadError);
              this.close();
            });

            stream.write('ping\n');
          });
      }).on('error', (e: Error) => {
        // This occurs when:
        //  - user supplies the wrong username or password
        //  - host cannot be reached, e.g. non-existant hostname
        // TODO: does this occur outside of startup, i.e. should it always reject?
        log.warn('%1: connection error: %2', this.name_, e);
        this.close();
        R(new Error('could not login: ' + e.toString()));
      }).on('end', () => {
        // Occurs when the connection is "over" for any reason, including
        // failed connection.
        log.debug('%1: connection ended', this.name_);
        this.close();
      }).on('close', (hadError: boolean) => {
        // TODO: when does this occur? don't see it on normal close or failure
        log.debug('%1: connection close: %2', this.name_, hadError);
        this.close();
      }).connect({
        host: this.address_,
        port: SSH_SERVER_PORT,
        username: SSH_SERVER_USERNAME,
        password: SSH_SERVER_PASSWORD
      });
    });
  }

  public sendMessage = (s: string): void => {
    if (this.state_ !== ConnectionState.ESTABLISHED) {
      throw new Error('can only connect in ESTABLISHED state');
    }
    this.stream_.write(s + '\n');
  }

  public close = (): void => {
    log.debug('%1: close', this.name_);
    if (this.state_ === ConnectionState.TERMINATED) {
      log.debug('%1: already closed', this.name_);
    } else {
      this.setState_(ConnectionState.TERMINATED);
      this.client_.end();
      // TODO: what about the stream?
    }
  }

  private setState_ = (newState: ConnectionState) => {
    log.debug('%1: %2 -> %3', this.name_, ConnectionState[this.state_],
      ConnectionState[newState]);
    this.state_ = newState;
  }

  public getState = (): ConnectionState => {
    return this.state_;
  }
}
