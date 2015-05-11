/// <reference path='../../../third_party/freedom-typings/rtcpeerconnection.d.ts' />

import net = require('../../../third_party/uproxy-networking/net/net.types');
import social = require('./social');
import ui = require('./ui');

// --- Core <--> UI Interfaces ---

export interface UserFeedback {
  email     :string;
  feedback  :string;
  logs      :boolean;
  browserInfo :string;
}

// Object containing description so it can be saved to storage.
export interface GlobalSettings {
  version          :number;
  description      :string;
  stunServers      :freedom_RTCPeerConnection.RTCIceServer[];
  hasSeenSharingEnabledScreen :boolean;
  hasSeenWelcome   :boolean;
  allowNonUnicast  :boolean;
  mode             :ui.Mode;
  statsReportingEnabled :boolean;
}

export interface InitialState {
  networkNames :string[];
  globalSettings :GlobalSettings;
  onlineNetwork: social.NetworkState;
}

export interface ConnectionState {
  localGettingFromRemote :social.GettingState;
  localSharingWithRemote :social.SharingState;
  bytesSent :number;
  bytesReceived :number;
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
  GET_INITIAL_STATE = 1000,
  RESTART,
  LOGIN,
  LOGOUT,
  SEND_INSTANCE_HANDSHAKE_MESSAGE,
  START_PROXYING,
  STOP_PROXYING,
  MODIFY_CONSENT,       // TODO: make this work with the consent piece.
  START_PROXYING_COPYPASTE_GET,
  STOP_PROXYING_COPYPASTE_GET,
  START_PROXYING_COPYPASTE_SHARE,
  STOP_PROXYING_COPYPASTE_SHARE,
  COPYPASTE_SIGNALLING_MESSAGE,

  // Payload should be a HandleManualNetworkInboundMessageCommand.
  HANDLE_MANUAL_NETWORK_INBOUND_MESSAGE,
  SEND_CREDENTIALS,
  UPDATE_GLOBAL_SETTINGS,
  GET_LOGS,
  GET_NAT_TYPE
}

// Updates are sent from the Core to the UI, to update state that the UI must
// expose to the user.
//
// TODO: Finalize which of these can be removed, then clean up accordingly.
export enum Update {
  INITIAL_STATE = 2000,
  NETWORK,      // One particular network.
  USER_SELF,    // Local / myself on the network.
  USER_FRIEND,  // Remote friend on the roster.
  INSTANCE,
  COMMAND_FULFILLED,
  COMMAND_REJECTED,
  START_GETTING_FROM_FRIEND,
  STOP_GETTING_FROM_FRIEND,
  START_GIVING_TO_FRIEND,
  STOP_GIVING_TO_FRIEND,
  // Payload should be a Message.
  MANUAL_NETWORK_OUTBOUND_MESSAGE,
  // TODO: "Get credentials" is a command, not an "update". Consider
  // renaming the "Update" enum.
  GET_CREDENTIALS,
  LAUNCH_UPROXY,

  SIGNALLING_MESSAGE, /* copypaste messages */
  START_GETTING,
  STOP_GETTING,
  START_GIVING,
  STOP_GIVING,
  STATE,
  FRIEND_FAILED_TO_GET,
  POST_TO_CLOUDFRONT
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
  // TODO: Implement this or remove it.
  // sendInstanceHandshakeMessage(clientId :string) : void;

  modifyConsent(command :ConsentCommand) : void;

  getLogs() :Promise<string>;

  // CopyPaste interactions

  /*
   * The promise fulfills with an endpoint that can be used to proxy through
   * if sucessfully started or rejects otherwise
   */
  startCopyPasteGet() :Promise<net.Endpoint>;

  /*
   * The promise fulfills when the connection is fully closed and state has
   * been cleaned up
   */
  stopCopyPasteGet() :Promise<void>;

  startCopyPasteShare() :void;

  /*
   * The promise fulfills when the connection is fully closed and state has
   * been cleaned up
   */
  stopCopyPasteShare() :Promise<void>;

  sendCopyPasteSignal(signal :social.PeerMessage) :void;

  // Using peer as a proxy.
  start(instancePath :social.InstancePath) : Promise<net.Endpoint>;
  stop () : void;

  updateGlobalSettings(newSettings :GlobalSettings) : void;
  // TODO: rename toggle-option and/or replace with real configuration system.
  // TODO: Implement this or remove it.
  // changeOption(option :string) : void;

  login(network :string) : Promise<void>;
  logout(networkInfo :social.SocialNetworkInfo) : Promise<void>;

  // TODO: use Event instead of attaching manual handler. This allows event
  // removal, etc.
  onUpdate(update :Update, handler :Function) : void;
}

