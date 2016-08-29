/// <reference path='../../third_party/typings/index.d.ts' />

import loggingTypes = require('../lib/loggingprovider/loggingprovider.types');
import net = require('../lib/net/net.types');
import social = require('./social');
import ui = require('./ui');

// --- Core <--> UI Interfaces ---

export interface UserFeedback {
  email        :string;
  error        :string;
  feedback     :string;
  logs         :string;
  browserInfo  ?:string;
  proxyingId   ?:string;
  feedbackType ?:UserFeedbackType;
}

export enum UserFeedbackType {
  USER_INITIATED = 0,
  PROXYING_FAILURE = 1,
  CLOUD_CONNECTIONS_DISCONNECTED = 2,
  CLOUD_SERVER_NO_CONNECT = 3,
  CLOUD_SERVER_NO_START = 4,
  TROUBLE_SIGNING_IN = 5,
  NO_FRIENDS = 6,
  TROUBLE_STARTING_CONNECTION = 7,
  DISCONNECTED_FROM_FRIEND = 8,
  OTHER_FEEDBACK = 9
}

// Object containing an update to apply to another object
export interface UpdateGlobalSettingArgs {
  name: string; // field being updated
  value: Object; // anything that's getting updated
}

// Object containing description so it can be saved to storage.
export interface GlobalSettings {
  version          :number;
  description      :string;
  stunServers      :freedom.RTCPeerConnection.RTCIceServer[];
  hasSeenSharingEnabledScreen :boolean;
  hasSeenWelcome   :boolean;
  hasSeenMetrics   :boolean;
  allowNonUnicast  :boolean;
  mode             :ui.Mode;
  statsReportingEnabled :boolean;
  consoleFilter    :loggingTypes.Level;
  language         :string;
  force_message_version :number;
  quiverUserName :string;
  proxyBypass: string[];
  enforceProxyServerValidity :boolean;
  validProxyServers :ValidProxyServerIdentities;
  activePromoId: string;
  shouldHijackDO: boolean;
  crypto: boolean;
  reproxy: reproxySettings;
  // A list of strings, each represented as a constant below, with
  // prefix 'FEATURE_'.
  enabledExperiments :string[];
}

export const FEATURE_VERIFY = 'verify';

export interface InitialState {
  networkNames :string[];
  cloudProviderNames :string[];
  globalSettings :GlobalSettings;
  onlineNetworks :social.NetworkState[];
  availableVersion :string;
  portControlSupport :PortControlSupport;
}

export interface ValidProxyServerIdentities {
  [key: string]: string;
}

export interface ManagedPolicyUpdate {
  enforceProxyServerValidity :boolean;
  validProxyServers :ValidProxyServerIdentities;
}

export interface ConnectionState {
  localGettingFromRemote :social.GettingState;
  localSharingWithRemote :social.SharingState;
  bytesSent :number;
  bytesReceived :number;
  activeEndpoint :net.Endpoint;
}

// Contains settings directing rtc-to-net server to go directly to net or
// reproxy through a socks proxy server (such as local Tor proxy).
export interface reproxySettings {
  enabled       :boolean;      // Reproxy through socks is enabled
  socksEndpoint :net.Endpoint; // Endpoint through which to reproxy
}

// --- Communications ---

// Commands are sent from the UI to the Core due to a user interaction.
// This fully describes the set of commands that Core must respond to.
//
// Enum value names should be verb phrases that clearly describe the action
// being requested.
//
// TODO: Finalize which of these can be removed, then clean up accordingly.
export enum Command {
  GET_INITIAL_STATE_DEPRECATED_0_8_10 = 1000,
  RESTART = 1001,
  LOGIN = 1002,
  LOGOUT = 1003,
  SEND_INSTANCE_HANDSHAKE_MESSAGE = 1004,
  START_PROXYING = 1005,
  STOP_PROXYING = 1006,
  MODIFY_CONSENT = 1007, // TODO: make this work with the consent piece.

  SEND_CREDENTIALS = 1014,
  UPDATE_GLOBAL_SETTINGS = 1015, // Fully replaces the uProxy global settings
  GET_LOGS = 1016,
  GET_NAT_TYPE = 1017,
  PING_UNTIL_ONLINE = 1018,
  GET_FULL_STATE = 1019,
  GET_VERSION = 1020,
  HANDLE_CORE_UPDATE = 1021,
  REFRESH_PORT_CONTROL = 1022,
  CREDENTIALS_ERROR = 1023,
  GET_INVITE_URL = 1025,
  SEND_EMAIL = 1026,
  ACCEPT_INVITATION = 1027,
  INVITE_GITHUB_USER = 1028,
  CLOUD_UPDATE = 1029,
  UPDATE_ORG_POLICY = 1030,
  REMOVE_CONTACT = 1031,
  POST_REPORT = 1032,
  VERIFY_USER = 1033,
  VERIFY_USER_SAS = 1034,
  GET_PORT_CONTROL_SUPPORT = 1035,
  UPDATE_GLOBAL_SETTING = 1036, // Updates a single global setting
  CHECK_REPROXY = 1037
}

// Updates are sent from the Core to the UI, to update state that the UI must
// expose to the user.
export enum Update {
  INITIAL_STATE_DEPRECATED_0_8_10 = 2000,
  NETWORK = 2001,      // One particular network.
  USER_SELF = 2002,    // Local / myself on the network.
  USER_FRIEND = 2003,  // Remote friend on the roster.
  COMMAND_FULFILLED = 2005,
  COMMAND_REJECTED = 2006,
  START_GETTING_FROM_FRIEND = 2007,
  STOP_GETTING_FROM_FRIEND = 2008,
  START_GIVING_TO_FRIEND = 2009,
  STOP_GIVING_TO_FRIEND = 2010,
  // TODO: "Get credentials" is a command, not an "update". Consider
  // renaming the "Update" enum.
  GET_CREDENTIALS = 2012,
  LAUNCH_UPROXY = 2013,

  SIGNALLING_MESSAGE = 2014, /* copypaste messages */
  START_GETTING = 2015,
  STOP_GETTING = 2016,
  START_GIVING = 2017,
  STOP_GIVING = 2018,
  STATE = 2019,
  FAILED_TO_GIVE = 2020,
  FAILED_TO_GET = 2023,
  CORE_UPDATE_AVAILABLE = 2024,
  PORT_CONTROL_STATUS = 2025,
  // Payload is a string, obtained from the SignalBatcher in uproxy-lib.
  ONETIME_MESSAGE = 2026,
  CLOUD_INSTALL_STATUS = 2027,
  REMOVE_FRIEND = 2028, // Removed friend from roster.
  // Payload is an integer between 0 and 100.
  CLOUD_INSTALL_PROGRESS = 2029,
  REFRESH_GLOBAL_SETTINGS = 2030, // Sends UI new canonical version of global settings
  REPROXY_ERROR = 2031,  // Controls reproxy error bar notification to sharer
  REPROXY_WORKING = 2032
}

// Action taken by the user. These values are not on the wire. They are passed
// in messages from the UI to the core. They correspond to the different
// buttons that the user may be clicking on.
export enum ConsentUserAction {
  // Actions made by user w.r.t. remote as a proxy
  REQUEST = 5000, CANCEL_REQUEST, IGNORE_OFFER, UNIGNORE_OFFER,
  // Actions made by user w.r.t. remote as a client
  OFFER = 5100, CANCEL_OFFER, IGNORE_REQUEST, UNIGNORE_REQUEST,
}

// Payload of FAILED_TO_GET and FAILED_TO_GIVE messages.
export interface FailedToGetOrGive {
  name: string;
  proxyingId: string;
}

/**
 * ConsentCommands are sent from the UI to the Core, to modify the consent of
 * a :RemoteInstance in the local client. (This is not sent on the wire to
 * the peer). This should only be passed along with a `Command.MODIFY_CONSENT`
 * command.
 */
export interface ConsentCommand {
  path    :social.UserPath;
  action  :ConsentUserAction;
}

export interface CloudfrontPostData {
  payload        :Object;
  cloudfrontPath :string;
}

export enum LoginType {
  INITIAL = 0,
  RECONNECT,
  TEST
}

export interface LoginArgs {
  network :string;
  loginType :LoginType;
  userName ?:string;
}

export interface LoginResult {
  userId     :string;
  instanceId :string;
}

export interface NetworkInfo {
  natType ?:string;
  pmpSupport :boolean;
  pcpSupport :boolean;
  upnpSupport :boolean;
  errorMsg ?:string;
};

export interface EmailData {
  networkInfo: social.SocialNetworkInfo;
  to :string;
  subject :string;
  body :string;
};

// Data needed to accept user invites.
export interface AcceptInvitationData {
  network :social.SocialNetworkInfo;
  tokenObj ?:any;
  userId ?:string;
};

// Data needed to generate an invite URL.
export interface CreateInviteArgs {
  network :social.SocialNetworkInfo;
  isRequesting :boolean;
  isOffering :boolean;
  userId ?:string;  // for GitHub only
};

export enum PortControlSupport {PENDING, TRUE, FALSE};

export enum ReproxyCheck {PENDING, TRUE, FALSE, UNCHECKED};

export enum CloudOperationType {
  CLOUD_INSTALL = 0,
  CLOUD_DESTROY = 1,
  CLOUD_REBOOT = 2,
  CLOUD_HAS_OAUTH = 3
}

// Arguments to cloudUpdate
export interface CloudOperationArgs {
  operation: CloudOperationType;
  // Use this cloud computing provider to access a server.
  providerName :string;
  // Provider-specific region in which to locate a new server.
  region ?:string;
};

// Result of cloudUpdate
export interface CloudOperationResult {
  hasOAuth? :boolean;
};

// Argument to removeContact
export interface RemoveContactArgs {
  // Name of the network the contact is a part of
  networkName :string,
  // userId of the contact you want to remove
  userId :string
};

export interface PostReportArgs {
  payload: Object;
  path: string;
};

export interface FinishVerifyArgs {
  inst: social.InstancePath,
  sameSAS: boolean
};

/**
 * The primary interface to the uProxy Core.
 *
 * This will be enforced for both the actual core implementation, as well as
 * abstraction layers such as the Chrome Extension, so that all components
 * which speak to the core benefit from this consistency.
 */
// TODO: Rename CoreApi.
export interface CoreApi {
  // Send your own instanceId to target clientId.

  getFullState() :Promise<InitialState>;

  modifyConsent(command :ConsentCommand) :void;

  getLogs() :Promise<string>;

  // Using peer as a proxy.
  start(instancePath :social.InstancePath) : Promise<net.Endpoint>;
  stop (path :social.InstancePath) : void;

  updateGlobalSettings(newSettings :GlobalSettings) :void;
  updateGlobalSetting(change: UpdateGlobalSettingArgs): void;

  login(loginArgs :LoginArgs) : Promise<LoginResult>;
  logout(networkInfo :social.SocialNetworkInfo) : Promise<void>;

  // TODO: use Event instead of attaching manual handler. This allows event
  // removal, etc.
  onUpdate(update :Update, handler :Function) :void;

  pingUntilOnline(pingUrl :string) : Promise<void>;
  getVersion() :Promise<{ version :string }>;

  getInviteUrl(data :CreateInviteArgs): Promise<string>;

  // Installs or destroys uProxy on a server. Generally a long-running operation, so
  // callers should expose CLOUD_INSTALL_STATUS updates to the user.
  // This may also invoke an OAuth flow, in order to perform operations
  // with the cloud computing provider on the user's behalf.
  // Update: This is also now used for CloudOperationType.CLOUD_HAS_OAUTH,
  // which is neither long-running nor potentially triggers an OAuth flow.
  cloudUpdate(args :CloudOperationArgs): Promise<CloudOperationResult>;

  // Removes contact from roster, storage, and friend list
  removeContact(args :RemoveContactArgs) : Promise<void>;

  // Make a domain-fronted POST request to the uProxy logs/stats server.
  postReport(args:PostReportArgs) : Promise<void>;

  // Start a ZRTP key-verification session.
  verifyUser(inst :social.InstancePath) :void;

  // Confirm or reject the SAS in a ZRTP key-verification session.
  finishVerifyUser(args:FinishVerifyArgs) :void;

  inviteGitHubUser(data :CreateInviteArgs) : Promise<void>;

  getPortControlSupport(): Promise<PortControlSupport>;

  // Check if socks reproxy exists at input port
  checkReproxy(port :number): Promise<ReproxyCheck>;
}
