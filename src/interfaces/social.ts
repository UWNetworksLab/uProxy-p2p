/**
 * The 'User' type is used both in uProxy's core and UI, so there will be a base
 * interface to be extended as classes specific to particular components.
 */

import net = require('../../../third_party/uproxy-lib/net/net.types');
import uproxy_core_api = require('./uproxy_core_api');

export interface UserPath {
  network :SocialNetworkInfo;
  userId :string;
}

export interface SocialNetworkInfo {
  name :string;
  userId :string;
}

export interface InstancePath extends UserPath {
  instanceId :string;
}

//
export interface BaseUser {
  userId :string;
  name :string;
}

export interface StopProxyInfo {
  instanceId :string;
  error      :boolean;
}

export interface LocalInstanceState {
  instanceId  :string;
  userId      :string;
  userName    :string;
  imageData   :string;
}

export interface NetworkMessage {
  name        :string;
  displayName :string;
  online      :boolean;
  userId      :string;
  userName    :string;
  imageData   :string
}

export interface UserProfileMessage {
  imageData    ?:string; // Image URI (e.g. data:image/png;base64,adkwe329...)
  name         ?:string;
  url          ?:string;
  userId       :string;
}

export interface ConsentState {
  ignoringRemoteUserOffer :boolean;
  ignoringRemoteUserRequest :boolean;
  localGrantsAccessToRemote :boolean;
  localRequestsAccessFromRemote :boolean;
  remoteRequestsAccessFromLocal :boolean;
}

export interface InstanceData {
  bytesReceived          :number;
  bytesSent              :number;
  description            :string;
  instanceId             :string;
  isOnline               :boolean;
  localGettingFromRemote :GettingState;
  localSharingWithRemote :SharingState;
}

export interface UserData {
  allInstanceIds      ?:string[];
  consent             :ConsentState;
  isOnline            :boolean;
  network             :string;
  offeringInstances   ?:InstanceData[];
  instancesSharingWithLocal  :string[];
  user                :UserProfileMessage;
}

export interface NetworkState {
  name         :string;
  displayName  :string;
  profile      :UserProfileMessage;
  // TODO: bad smell: UI data should not be
  roster       :{[userId :string] :UserData };
}

export interface NetworkOptions {
  isFirebase :boolean;
  enableMonitoring :boolean;
  areAllContactsUproxy :boolean;
  displayName ?:string;
}

/**
 * Messages are sent from Core to a remote Core - they are peer communications
 * between uProxy users. This enum describes the possible Message types.
 */
// TODO: move into generic_core.
// TODO: rename to PeerMessageType & PeerMessage.
// TODO: consider every message having every field, and that MessageType is
// no longer needed. This would use fewer larger messages.
export enum PeerMessageType {
  INSTANCE = 3000,  // Instance messages notify the user about instances.
  // These are for the signalling-channel. The payloads are arbitrary, and
  // could be specified from uProxy, or could also be SDP headers forwarded
  // from socks-rtc's RTCPeerConnection.
  SIGNAL_FROM_CLIENT_PEER,
  SIGNAL_FROM_SERVER_PEER,
  // Request that an instance message be sent back from a peer.
  INSTANCE_REQUEST
}

export interface PeerMessage {
  type :PeerMessageType;
  // TODO: Add a comment to explain the types that data can take and their
  // relationship to MessageType.
  data: Object;
}

// Actual type sent over the wire; version is added immediately before
// JSON-ification.
export interface VersionedPeerMessage extends PeerMessage {
  // Client version of the peer, viz. MESSAGE_VERSION.
  version: number;
}

// The payload of a HANDLE_MANUAL_NETWORK_INBOUND_MESSAGE command. There is a
// client ID for the sender but no user ID because in the manual network
// there is no concept of a single user having multiple clients; in the
// manual network the client ID uniquely identifies the user.
export interface HandleManualNetworkInboundMessageCommand {
  message         :VersionedPeerMessage;
  senderClientId  :string;
}

// The different states that uProxy consent can be in w.r.t. a peer. These
// are the values that get sent or received on the wire.
export interface ConsentWireState {
  isRequesting :boolean;
  isOffering   :boolean;
}

/**
 * Instance Handshakes are sent between uProxy installations to notify each
 * other about existence.
 */
export interface InstanceHandshake {
  instanceId  :string;
  publicKey   :string;
  consent     :ConsentWireState;
  description ?:string;
  name        :string;
  userId      :string;
}

// Describing whether or not a remote instance is currently accessing or not,
// assuming consent is GRANTED for that particular pathway.
export enum GettingState {
  NONE = 100,
  TRYING_TO_GET_ACCESS,
  GETTING_ACCESS
}

export enum SharingState {
  NONE = 200,
  TRYING_TO_SHARE_ACCESS,
  SHARING_ACCESS
}

// We use this to map Freedom's untyped social network structures into a real
// type-script enum & interface.

// Status of a client; used for both this client (in which case it will be
// either ONLINE or OFFLINE)
export enum ClientStatus {
  OFFLINE,
  // This client runs the same freedom.js app as you and is online
  ONLINE,
  // This client is online, but not with the same application/agent type
  // (i.e. can be useful to invite others to your freedom.js app)
  ONLINE_WITH_OTHER_APP,
}

// Status of a client connected to a social network.
export interface ClientState {
  userId    :string;
  clientId  :string;
  status    :ClientStatus;
  timestamp :number;
}


export interface UserState {
  name        :string;
  imageData   :string;
  url         :string;
  // Only save and load the instanceIDs. The actual RemoteInstances will
  // be saved and loaded separately.
  instanceIds :string[];
  consent     :ConsentState;
}


export interface RemoteUserInstance {
  start() :Promise<net.Endpoint>;
  stop() :Promise<void>;
}

// Payload for SIGNAL_FROM_CLIENT_PEER and SIGNAL_FROM_SERVER_PEER messages.
// Other payload types exist, e.g. bridging peerconnection signals.
export interface SignallingMetadata {
  // Random ID associated with this proxying attempt.
  // Used for logging purposes and implicitly delimits proxying attempts.
  proxyingId ?:string;
}

/**
 *
 */
export interface RemoteUser {
  modifyConsent(action:uproxy_core_api.ConsentUserAction) : Promise<void>;
  getInstance(instanceId:string) :RemoteUserInstance;
}

/**
 * The |Network| class represents a single network and the local uProxy client's
 * interaction as a user on the network.
 *
 * NOTE: All JSON stringify / parse happens automatically through the
 * network's communication methods. The rest of the code should deal purely
 * with the data objects.
 *
 * Furthermore, at the Social.Network level, all communications deal directly
 * with the clientIds. This is because instanceIds occur at the User level, as
 * the User manages the instance <--> client mappings (see 'user.ts').
 */
export interface Network {
  name       :string;
  // TODO: Review visibility of these attributes and the interface.
  roster     :{[userId:string]:RemoteUser};
  // TODO: Make this private. Have other objects use getLocalInstance
  // instead.
  myInstance :LocalInstanceState;

  /**
   * Logs in to the network. Updates the local client information, as
   * appropriate, and sends an update to the UI upon success. Does nothing if
   * already logged in.
   */
  login :(reconnect :boolean) => Promise<void>;

  getStorePath :() => string;

  /**
   * Does nothing if already logged out.
   */
  logout :() => Promise<void>;

  /**
   * Returns true iff a login is pending (e.g. waiting on user's password).
   */
  getLocalInstanceId :() => string;

  /**
   * Returns the User corresponding to |userId|.
   */
  getUser :(userId :string) => RemoteUser;

  /**
   * Ask the social network to add the user.
   */
  addUserRequest: (networkData :string) => void;

  /**
   * Generates an invite token
   */
  getInviteUrl: () => Promise<string>;

  /**
   * Generates an invite token
   */
  sendEmail: (to :string, subject :string, body :string) => void;

  /**
    * Resends the instance handeshake to all uProxy instances.
    */
  resendInstanceHandshakes :() => void;

  /**
   * Sends a message to a remote client.
   *
   * Assumes that |clientId| is valid. Implementations of Social.Network do
   * not manually manage lists of clients or instances. (That is handled in
   * user.ts, which calls Network.send after doing the validation checks
   * itself.)
   *
   * Still, it is expected that if there is a problem, such as the clientId
   * being invalid / offline, the promise returned from the social provider
   * will reject.
   */
  send :(user :BaseUser, clientId:string, msg:PeerMessage)
      => Promise<void>;

  getNetworkState : () => NetworkState;

  areAllContactsUproxy : () => boolean;
}

