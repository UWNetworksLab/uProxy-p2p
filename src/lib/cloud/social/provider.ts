import '../social/monkey/process';

import * as arraybuffers from '../../arraybuffers/arraybuffers';
import * as crypto from 'crypto';
import * as linefeeder from '../../net/linefeeder';
import * as logging from '../../logging/logging';
import * as queue from '../../handler/queue';
import Pinger from '../../net/pinger';

// https://github.com/borisyankov/DefinitelyTyped/blob/master/ssh2/ssh2-tests.ts
import * as ssh2 from 'ssh2';
var Client = require('ssh2').Client;

declare const freedom: freedom.FreedomInModuleEnv;

var log: logging.Log = new logging.Log('cloud social');

const SSH_SERVER_PORT = 5000;

const ZORK_HOST = 'zork';
const ZORK_PORT = 9000;

// Key under which our contacts are saved in storage.
const STORAGE_KEY = 'cloud-social-contacts';

// Timeout for establishing an SSH connection.
const CONNECT_TIMEOUT_MS = 10000;

// Retry timing for SSH connection establishment.
const INITIAL_CONNECTION_INTERVAL_MS = 500;
const MAX_CONNECTION_INTERVAL_MS = 10000;

// Servers prior to MESSAGE_VERSION 6 (which introduced RC4 obfuscation) didn't
// support the message_version command. Assume such servers are running
// MESSAGE_VERSION=4 (caesar obfuscation).
const DEFAULT_MESSAGE_VERSION = 4;

// Credentials for accessing a cloud instance.
// The serialised, base64 form is distributed amongst users.
export interface Invite {
  // Hostname or IP of the cloud instance.
  // This is the host on which sshd is running, so it should
  // be directly accessible from the client.
  host: string;
  // Username.
  user: string;
  // Private key, base64-encoded.
  key: string;
  // True iff uProxy has root access on the server, i.e. uProxy deployed it.
  isAdmin?: boolean;
  // Host key that should be used to verify the server, base-64 encoded
  // (from known_hosts file or public key)
  hostKey?: string;
}

// Type of the object placed, in serialised form, in storage
// under STORAGE_KEY.
interface SavedContacts {
  // TODO: remove this, invites are now embedded in contacts.
  invites?: Invite[];
  contacts?: SavedContact[];
}

// A contact as saved to storage, consisting of the invite
// plus any data fetched from the server on login (effectively,
// this on-demand data is cached here).
interface SavedContact {
  invite?: Invite;
  description?: string;
  version?: number;
}

// State of remote user's relationship to local user.
// Defined in github.com/uProxy/uproxy/blob/dev/src/interfaces/social.ts
//
// For cloud instances, only CLOUD_INSTANCE_CREATED_BY_LOCAL or
// CLOUD_INSTANCE_SHARED_WITH_LOCAL are possible statuses.
enum UserStatus {
  FRIEND = 0,
  LOCAL_INVITED_BY_REMOTE = 1,
  REMOTE_INVITED_BY_LOCAL = 2,
  CLOUD_INSTANCE_CREATED_BY_LOCAL = 3,
  CLOUD_INSTANCE_SHARED_WITH_LOCAL = 4
}

// Returns a VersionedPeerMessage, as defined in interfaces/social.ts
// in the uProxy repo.
//
// type is a PeerMessageType value (also defined in that file) and
// payload is an arbitrary payload, e.g. an instance message.
// TODO: use typings from the uProxy repo
function makeVersionedPeerMessage(
    type:number,
    payload:Object,
    version?:number) : any {
  return {
    type: type,
    data: payload,
    version: version || DEFAULT_MESSAGE_VERSION
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
function makeInstanceMessage(address:string, description?:string): any {
  return {
    instanceId: address,
    // Shown in the contacts list while the user's list item is expanded
    description: description,
    consent: {
      isRequesting: false,
      isOffering: true
    },
    name: address,
    userId: address
  };
}

// To see how these fields are handled, see
// generic_core/social.ts#handleUserProfile in the uProxy repo. We omit
// the status field since remote-user.ts#update will use FRIEND as a default.
function makeUserProfile(
    address: string,
    isAdmin ?:boolean): freedom.Social.UserProfile {
  var status = isAdmin ? UserStatus.CLOUD_INSTANCE_CREATED_BY_LOCAL :
      UserStatus.CLOUD_INSTANCE_SHARED_WITH_LOCAL;
  return {
    userId: address,
    name: address,
    status: status
  };
}

// Exposes Zork instances as friends.
//
// Intended for use with the run_cloud.sh script in the uproxy-docker
// repo, which will spin up the expected configuration:
//  - an SSH server running on port 5000, with an account named "giver"
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
  private storage_: freedom.Storage.Storage = freedom['core.storage']();

  // Saved contacts, keyed by host.
  private savedContacts_: { [host: string]: SavedContact } = {};

  // SSH connections, keyed by host.
  private clients_: { [host: string]: Promise<Connection> } = {};

  // Map from host to whether it is online.  Hosts not in the map are assumed
  // to be offline.
  private onlineHosts_: { [host: string]: boolean } = {};

  // Map from host to intervalId used for monitoring online presence.
  private onlinePresenceMonitorIds_: { [host: string]: NodeJS.Timer } = {};

  private static PING_INTERVAL_ = 60000;

  private instanceId_ :string;

  constructor(private dispatchEvent_: (name: string, args: Object) => void) { }

  // Emits the messages necessary to make the user appear online
  // in the contacts list.
  private notifyOfUser_ = (contact: SavedContact) : void => {
    this.dispatchEvent_('onUserProfile', makeUserProfile(
        contact.invite.host, contact.invite.isAdmin));

    var clientState = this.makeClientState_(contact.invite.host);
    this.dispatchEvent_('onClientState', clientState);

    if (this.isOnline_(contact.invite.host)) {
      // Pretend that we received a message from a remote uProxy client.
      this.dispatchEvent_('onMessage', {
        from: clientState,
        // INSTANCE
        message: JSON.stringify(makeVersionedPeerMessage(3000, makeInstanceMessage(
            contact.invite.host, contact.description), contact.version))
      });
    }
  }

  // Establishes an SSH connection to a server, first shutting down
  // any that previously exists. Also emits an instance message,
  // allowing fields such as the description be updated on every
  // reconnect, and saves the contact to storage.
  private reconnect_ = (invite: Invite): Promise<Connection> => {
    log.debug('reconnecting to %1', invite.host);
    if (invite.host in this.clients_) {
      log.debug('closing old connection to %1', invite.host);
      this.clients_[invite.host].then((connection: Connection) => {
        connection.end();
      });
    }

    const connection = new Connection(invite, (message: Object) => {
      // Set the server to online, since we are receiving messages from them.
      this.setOnlineStatus_(invite.host, true);
      this.dispatchEvent_('onMessage', {
        from: this.makeClientState_(invite.host),
        // SIGNAL_FROM_SERVER_PEER,
        message: JSON.stringify(makeVersionedPeerMessage(3002,
            message, connection.getVersion()))
      });
    });

    this.clients_[invite.host] = connection.connect().then(() => {
      log.info('connected to zork on %1', invite.host);

      // Cloud server is online if a connection has succeeded.
      this.setOnlineStatus_(invite.host, true);

      // Fetch the banner, if available, then emit an instance message.
      connection.getBanner().then((banner: string) => {
        if (banner.length < 1) {
          log.debug('empty banner, leaving blank');
        }
        return banner;
      }, (e: Error) => {
        log.warn('failed to fetch banner: %1', e);
        return '';
      }).then((banner: string) => {
        this.savedContacts_[invite.host] = {
          invite: invite,
          description: banner,
          version: connection.getVersion()
        };
        this.notifyOfUser_(this.savedContacts_[invite.host]);
        this.saveContacts_();
      });

      return connection;
    });

    return this.clients_[invite.host];
  }

  // Loads contacts from storage and emits an instance message for each.
  // This makes all of the stored contacts appear online.
  private loadContacts_ = () => {
    log.debug('loadContacts');
    this.savedContacts_ = {};
    this.storage_.get(STORAGE_KEY).then((storedString: string) => {
      if (!storedString) {
        log.debug('no saved contacts');
        return;
      }
      log.debug('loaded contacts: %1', storedString);
      try {
        var savedContacts: SavedContacts = JSON.parse(storedString);
        if (savedContacts.contacts) {
          for (let contact of savedContacts.contacts) {
            this.savedContacts_[contact.invite.host] = contact;
            this.startMonitoringPresence_(contact.invite.host);
            this.notifyOfUser_(contact);
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
  private saveContacts_ = (): Promise<void> => {
    log.debug('saveContacts');
    return this.storage_.set(STORAGE_KEY, JSON.stringify(<SavedContacts>{
      contacts: Object.keys(this.savedContacts_).map(key => this.savedContacts_[key])
    })).then((unused: string) => {
      log.debug('saved contacts');
    }).catch((e) => {
      log.error('could not save contacts: %1', e);
      Promise.reject({
        message: e.message
      });
    });
  }

  // public login = (options: freedom.Social.LoginRequest):
  public login = (options: any):
      Promise<freedom.Social.ClientState> => {
    log.debug('login: %1', options);
    this.loadContacts_();
    this.instanceId_ = options.userName;
    console.error('got this.instanceId_ ' + this.instanceId_);
    // TODO: emit an onUserProfile event, which can include an image URL
    // TODO: base this on the user's public key?
    //       (shown in the "connected accounts" page)
    return Promise.resolve(this.makeClientState_('me'));
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
          // TODO: Do not reconnect if we have just invited
          //       the instance (safe because all we've done is run ping).
          log.info('new proxying session %1', payload.proxyingId);
          if (!(destinationClientId in this.savedContacts_)) {
            return Promise.reject({
              message: 'unknown client ' + destinationClientId
            });
          }
          return this.reconnect_(this.savedContacts_[destinationClientId].invite).then(
              (connection: Connection) => {
            connection.sendMessage('instanceid ' + this.instanceId_);
            connection.sendMessage('give');
          });
        } else {
          if (destinationClientId in this.clients_) {
            return this.clients_[destinationClientId].then(
                (connection: Connection) => {
              connection.sendMessage(JSON.stringify(payload));
            });
          } else {
            return Promise.reject({
              message: 'unknown client ' + destinationClientId
            });
          }
        }
      } else {
        return Promise.reject({
          message: 'message has no or wrong type field'
        });
      }
    } catch (e) {
      return Promise.reject({
        message: 'could not de-serialise message: ' + e.message
      });
    }
  }

  public clearCachedCredentials = (): Promise<void> => {
    return Promise.reject({
      message: 'clearCachedCredentials unimplemented'
    });
  }

  public getUsers = (): Promise<freedom.Social.Users> => {
    return Promise.reject({
      message: 'getUsers unimplemented'
    });
  }

  public getClients = (): Promise<freedom.Social.Clients> => {
    return Promise.reject({
      message: 'getClients unimplemented'
    });
  }

  public logout = (): Promise<void> => {
    log.debug('logout');
    for (let address in this.clients_) {
      this.clients_[address].then((connection: Connection) => {
        connection.end();
      });
    }
    return Promise.resolve();
  }

  ////
  // social2
  ////

  // Returns the invite code for the specified server.
  public inviteUser = (host: string): Promise<Object> => {
    log.debug('inviteUser');
    if (!(host in this.savedContacts_)) {
      return Promise.reject({
        message: 'unknown cloud instance ' + host
      });
    }
    const invite = this.savedContacts_[host].invite;
    return Promise.resolve(<Invite>{
      host: invite.host,
      user: invite.user,
      key: invite.key
    });
  }

  // Parses the networkData field, serialised to JSON, of invites.
  // The contact is immediately saved and added to the contacts list.
  public acceptUserInvitation = (inviteJson: string): Promise<void> => {
    log.debug('acceptUserInvitation');
    try {
      const invite = <Invite>JSON.parse(inviteJson);

      this.savedContacts_[invite.host] = {
        invite: invite
      };
      this.startMonitoringPresence_(invite.host);
      this.notifyOfUser_(this.savedContacts_[invite.host]);
      this.saveContacts_();
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(new Error('could not parse invite code: ' + e.message));
    }
  }

  public blockUser = (userId: string): Promise<void> => {
    return Promise.reject({
      message: 'blockUser unimplemented'
    });
  }

  // Removes a cloud contact from storage
  public removeUser = (host: string): Promise<void> => {
    log.debug('removeUser %1', host);
    if (!(host in this.savedContacts_)) {
      // Do not return an error because result is as expected.
      log.warn('cloud contact %1 is not in %2 - cannot remove from storage', host, STORAGE_KEY);
      return Promise.resolve();
    }
    this.stopMonitoringPresence_(host);
    // Remove host from savedContacts and clients
    delete this.savedContacts_[host];
    delete this.clients_[host];
    // Update storage with this.savedContacts_
    return this.saveContacts_();
  }

  private startMonitoringPresence_ = (host: string) => {
    if (this.onlinePresenceMonitorIds_[host]) {
      log.error('unexpected call to startMonitoringPresence_ for ' + host);
      return;
    }
    // Ping server every minute to see if it is online.  A server is considered
    // online if a connection can be established with the SSH port.  We stop
    // pinging for presence once the host is online, so as to not give away
    // that we are pinging uProxy cloud servers with a regular heartbeat.
    const ping = () : Promise<boolean> => {
      var pinger = new Pinger(host, SSH_SERVER_PORT);
      return pinger.pingOnce().then(() => {
        return true;
      }).catch(() => {
        return false;
      }).then((newOnlineValue: boolean) => {
        var oldOnlineValue = this.isOnline_(host);
        this.setOnlineStatus_(host, newOnlineValue);
        if (newOnlineValue !== oldOnlineValue) {
          // status changed, emit a new onClientState.
          this.notifyOfUser_(this.savedContacts_[host]);
          if (newOnlineValue) {
            // Connect in the background in order to fetch metadata such as
            // the banner (description).
            const invite = this.savedContacts_[host].invite;
            this.reconnect_(invite).catch((e: Error) => {
              log.error('failed to log into cloud server once online: %1', e.message);
            });
          }
        }
      });
    }
    this.onlinePresenceMonitorIds_[host] = setInterval(ping, CloudSocialProvider.PING_INTERVAL_);
    // Ping server immediately (so we don't have to wait 1 min for 1st result).
    ping();
  }

  private stopMonitoringPresence_ = (host: string) => {
    if (!this.onlinePresenceMonitorIds_[host]) {
      // We may have already stopped monitoring presence, e.g. because the
      // host has come online.
      return;
    }
    clearInterval(this.onlinePresenceMonitorIds_[host]);
    delete this.onlinePresenceMonitorIds_[host];
  }

  private isOnline_ = (host: string) => {
    return host === 'me' || this.onlineHosts_[host] === true;
  }

  private setOnlineStatus_ = (host: string, isOnline: boolean) => {
    this.onlineHosts_[host] = isOnline;
    if (isOnline) {
      // Stop monitoring presence once the client is online.
      this.stopMonitoringPresence_(host);
    }
  }

  // To see how these fields are handled, see
  // generic_core/social.ts#handleClient in the uProxy repo.
  private makeClientState_ = (address: string) : freedom.Social.ClientState => {
    return {
      userId: address,
      clientId: address,
      // https://github.com/freedomjs/freedom/blob/master/interface/social.json
      status: this.isOnline_(address) ? 'ONLINE' : 'OFFLINE',
      timestamp: Date.now()
    };
  }
}

enum ConnectionState {
  NEW,
  CONNECTING,
  ESTABLISHING_TUNNEL,
  WAITING_FOR_PING,
  WAITING_FOR_VERSION,
  ESTABLISHED,
  TERMINATED
}

class Connection {
  private static COMMAND_DELIMITER = arraybuffers.decodeByte(
      arraybuffers.stringToArrayBuffer('\n'));

  // Number of instances created, for logging purposes.
  private static id_ = 0;

  private state_ = ConnectionState.NEW;

  private connection_ = new Client();

  // The tunneled connection, i.e. secure link to Zork.
  private tunnel_ :ssh2.Channel;

  // Server's MESSAGE_VERSION.
  private version_ = DEFAULT_MESSAGE_VERSION;

  constructor(
      private invite_: Invite,
      private received_: (message:Object) => void,
      private name_: string = 'tunnel' + Connection.id_++) {}

  // TODO: timeout
  public connect = (): Promise<void> => {
    if (this.state_ !== ConnectionState.NEW) {
      return Promise.reject({
        message: 'can only connect in NEW state'
      });
    }
    this.state_ = ConnectionState.CONNECTING;

    let connectConfig: ssh2.ConnectConfig = {
      host: this.invite_.host,
      port: SSH_SERVER_PORT,
      username: this.invite_.user,
      readyTimeout: CONNECT_TIMEOUT_MS,
      // Remaining fields only for type-correctness.
      tryKeyboard: false,
      debug: undefined
    };

    if (this.invite_.key) {
      connectConfig['privateKey'] = new Buffer(this.invite_.key, 'base64');
    }

    if (this.invite_.hostKey) {
      connectConfig.hostHash = 'sha1';
      let keyBuffer = new Buffer(this.invite_.hostKey, 'base64');
      let expectedHash = crypto.createHash('sha1').update(keyBuffer).digest('hex');
      connectConfig.hostVerifier = (keyHash :string) => {
        return keyHash === expectedHash;
      };
    }

    return new Promise<void>((F, R) => {
      this.connection_.on('ready', () => {
        // TODO: set a timeout here, too
        this.setState_(ConnectionState.ESTABLISHING_TUNNEL);
        this.connection_.forwardOut(
          // TODO: since we communicate using the stream, what does this mean?
          '127.0.0.1', 0,
          ZORK_HOST, ZORK_PORT, (e: Error, tunnel: ssh2.Channel) => {
            if (e) {
              this.end();
              R({
                message: 'error establishing tunnel: ' + e.message
              });
              return;
            }

            this.setState_(ConnectionState.WAITING_FOR_PING);

            var bufferQueue = new queue.Queue<ArrayBuffer, void>();
            new linefeeder.LineFeeder(bufferQueue).setSyncHandler((reply: string) => {
              log.debug('%1: received message: %2', this.name_, reply);
              switch (this.state_) {
                case ConnectionState.WAITING_FOR_PING:
                  if (reply === 'ping') {
                    this.setState_(ConnectionState.WAITING_FOR_VERSION);
                    tunnel.write('version\n');
                  } else {
                    this.end();
                    R({
                      message: 'did not receive ping from server on login: ' + reply
                    });
                  }
                  break;
                case ConnectionState.WAITING_FOR_VERSION:
                  const parsedVersion = parseInt(reply, 10);
                  if (isNaN(parsedVersion)) {
                    log.debug('%1: server does not support message_version, assuming %2',
                      this.name_, this.version_);
                    this.version_ = DEFAULT_MESSAGE_VERSION;
                  } else {
                    log.debug('%1: server is running MESSAGE_VERSION %2',
                      this.name_, this.version_);
                    this.version_ = parsedVersion;
                  }
                  this.setState_(ConnectionState.ESTABLISHED);
                  F();
                  break;
                case ConnectionState.ESTABLISHED:
                  try {
                    this.received_(JSON.parse(reply));
                  } catch (e) {
                    log.warn('%1: could not de-serialise signalling message: %2',
                      this.invite_, reply);
                  }
                  break;
                default:
                  log.warn('%1: did not expect message in state %2: %3',
                    this.name_, ConnectionState[this.state_], reply);
                  this.end();
              }
            });

            this.tunnel_ = tunnel;
            tunnel.on('data', (buffer: Buffer) => {
              // Make a copy before passing to the async queue.
              bufferQueue.handle(arraybuffers.bufferToArrayBuffer(new Buffer(buffer)));
            }).on('end', () => {
              log.debug('%1: tunnel end', this.name_);
            }).on('close', (hadError: boolean) => {
              log.debug('%1: tunnel close, with%2 error', this.name_, (hadError ? '' : 'out'));
            });

            tunnel.write('ping\n');
          });
      }).on('error', (e: Error) => {
        // This occurs when:
        //  - user supplies the wrong credentials
        //  - host cannot be reached, e.g. non-existant hostname
        log.warn('%1: connection error: %2', this.name_, e);
        this.setState_(ConnectionState.TERMINATED);
        R({
          message: 'could not login: ' + e.message
        });
      }).on('end', () => {
        log.debug('%1: connection end', this.name_);
        this.setState_(ConnectionState.TERMINATED);
        R({
          message: 'connection end without ping'
        });
      }).on('close', (hadError: boolean) => {
        log.debug('%1: connection close, with%2 error', this.name_, (hadError ? '' : 'out'));
        this.setState_(ConnectionState.TERMINATED);
        R({
          message: 'connection close without ping'
        });
      }).connect(connectConfig);
    });
  }

  public sendMessage = (s: string): void => {
    if (this.state_ !== ConnectionState.ESTABLISHED) {
      throw new Error('can only connect in ESTABLISHED state');
    }
    this.tunnel_.write(s + '\n');
  }

  public end = (): void => {
    log.debug('%1: close', this.name_);
    if (this.state_ !== ConnectionState.TERMINATED) {
      this.setState_(ConnectionState.TERMINATED);
      this.connection_.end();
    }
  }

  // Fetches the server's description, i.e. /banner.
  public getBanner = (): Promise<string> => {
    return this.exec_('cat /banner');
  }

  // Executes a command, fulfilling with the first line of the command's
  // output on stdout or rejecting if any output is received on stderr.
  // TODO: There is a close event with a return code which
  //       is probably a better indication of success.
  private exec_ = (command: string): Promise<string> => {
    log.debug('%1: execute command: %2', this.name_, command);
    if (this.state_ !== ConnectionState.ESTABLISHED) {
      return Promise.reject({
        message: 'can only execute commands in ESTABLISHED state'
      });
    }
    return new Promise<string>((F, R) => {
      this.connection_.exec(command, (e: Error, stream: ssh2.Channel) => {
        if (e) {
          R({
            message: 'failed to execute command: ' + e.message
          });
          return;
        }

        const stdoutRaw = new queue.Queue<ArrayBuffer, void>();
        const stdout = new linefeeder.LineFeeder(stdoutRaw);
        stdout.setSyncHandler((line: string) => {
          F(line);
        });

        stream.on('data', (data: Buffer) => {
          // Make a copy before passing to the async queue.
          stdoutRaw.handle(arraybuffers.bufferToArrayBuffer(new Buffer(data)));
        }).stderr.on('data', (data: Buffer) => {
          R({
            message: 'output received on STDERR: ' + data.toString()
          });
        }).on('end', () => {
          log.debug('%1: exec stream end', this.name_);
          stdout.flush();
        });
      });
    });
  }

  private setState_ = (newState: ConnectionState) => {
    log.debug('%1: %2 -> %3', this.name_, ConnectionState[this.state_],
      ConnectionState[newState]);
    this.state_ = newState;
  }

  public getState = (): ConnectionState => {
    return this.state_;
  }

  public getVersion = (): number => {
    return this.version_;
  }
}
