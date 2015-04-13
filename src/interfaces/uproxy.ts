  /**
   * uproxy.ts
   *
   * This file defines the base uProxy module. It contains Enums and interfaces
   * which are relevant to all parts of uProxy, notably for communication between
   * the Core and the UI.
   */

/// <reference path='../../../third_party/freedom-typings/rtcpeerconnection.d.ts' />

  // TODO: Move the notifications somewhere better.
  // /// <reference path='interfaces/ui.d.ts' />
  // /// <reference path='interfaces/persistent.d.ts' />
  // /// <reference path='networking-typings/communications.d.ts' />

import net = require('../../../third_party/uproxy-networking/net/net.types');

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
    SEND_FEEDBACK,
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
    FRIEND_FAILED_TO_GET
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

  // Messages to the peer form the boundary for JSON parse / stringify.
  export interface PeerMessage {
    type :PeerMessageType;
    // TODO: Add a comment to explain the types that data can take and their
    // relationship to MessageType.
    data :Object;
  }

  // The different states that uProxy consent can be in w.r.t. a peer. These
  // are the values that get sent or received on the wire.
  export interface ConsentWireState {
    isRequesting :boolean;
    isOffering   :boolean;
  }

  export interface ConsentState {
    localGrantsAccessToRemote :boolean;
    localRequestsAccessFromRemote :boolean;
    remoteRequestsAccessFromLocal :boolean;
    ignoringRemoteUserRequest :boolean;
    ignoringRemoteUserOffer :boolean;
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
    path    :UserPath;
    action  :ConsentUserAction;
  }

  // The payload of a HANDLE_MANUAL_NETWORK_INBOUND_MESSAGE command. There is a
  // client ID for the sender but no user ID because in the manual network
  // there is no concept of a single user having multiple clients; in the
  // manual network the client ID uniquely identifies the user.
  export interface HandleManualNetworkInboundMessageCommand {
    senderClientId  :string;
    message         :PeerMessage;
  }

  export interface UserFeedback {
    email     :string;
    feedback  :string;
    logs      :boolean;
    browserInfo :string;
  }

  // --- Core <--> UI Interfaces ---

  /**
   * The primary interface to the uProxy Core.
   *
   * This will be enforced for both the actual core implementation, as well as
   * abstraction layers such as the Chrome Extension, so that all components
   * which speak to the core benefit from this consistency.
   */
  // TODO: Rename CoreApi.
  export interface CoreAPI {
    // Send your own instanceId to target clientId.
    // TODO: Implement this or remove it.
    // sendInstanceHandshakeMessage(clientId :string) : void;

    modifyConsent(command :ConsentCommand) : void;

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

    sendCopyPasteSignal(signal :PeerMessage) :void;

    // Using peer as a proxy.
    start(instancePath :InstancePath) : Promise<net.Endpoint>;
    stop () : void;

    updateGlobalSettings(newSettings :GlobalSettings) : void;
    // TODO: rename toggle-option and/or replace with real configuration system.
    // TODO: Implement this or remove it.
    // changeOption(option :string) : void;

    login(network :string) : Promise<void>;
    logout(networkInfo :SocialNetworkInfo) : Promise<void>;

    // TODO: use Event instead of attaching manual handler. This allows event
    // removal, etc.
    onUpdate(update :Update, handler :Function) : void;
    sendFeedback(feedback :UserFeedback) : void;
  }

  /**
   * Common type for the message payloads sent between uProxy backend and ui.
   */
  export interface Payload {
    cmd :string;
    type :number;   // Some flavor of Enum, converted to a number.
    data ?:Object;  // Usually JSON.
    promiseId ?:number;  // Values >= 1 means success/error should be returned.
  }


  /**
   * Interface for browser specific backend - ui connector.
   */
  export interface CoreBrowserConnector {
    send(payload :Payload, skipQueue ?:Boolean) : void;

    onUpdate(update :Update, handler :Function) : void;

    restart() : void;

    status :StatusObject;
  }

  /**
   * The primary interface for the uProxy User Interface.
   * Currently, the UI update message types are specified in ui.d.ts.
   */
  // TODO: rename UiApi.
  export interface UIAPI {

    syncUser(UserMessage:UserMessage) : void;
    // TODO: Enforce these types of granular updates. (Doesn't have to be exactly
    // the below)...
    // updateAll(data:Object) : void;
  }

  interface ICoreOptions {
    allowNonroutableAddresses(enabled:boolean):void;
    setStunServers(servers:string[]):void;
    setTurnServers(servers:string[]):void;
  }

  // PromiseCommand is used when the UI makes requests to the Core which
  // require a promise to be returned. Because many requests can be made, the
  // UI needs to distinguish between them. The `promiseId` allows keeping track
  // of which command was issued. e.g. consider the user clicking to login to
  // multiple networks; we want the UI to know when each login completes.
  //
  // TODO: when freedom supports multiple runtime enviroments, this code should
  // be able to be removed.
  export interface PromiseCommand {
    data ?:Object;  // Usually JSON.
    promiseId :number;  // Values <= 1 means success/error should be returned.
  }

  /**
   * Enumeration of mutually-exclusive view states.
   */
  export enum View {
    SPLASH = 0,
    COPYPASTE,
    ROSTER,
    BROWSER_ERROR
  }

  /**
   * Enumeration of mutually-exclusive UI modes.
   */
  export enum Mode {
    GET = 0,
    SHARE
  }

  export var STORAGE_VERSION = 1;
  export var MESSAGE_VERSION = 1;

export module Social {
  export var MANUAL_NETWORK_ID = 'Manual';
}

// We use this to map Freedom's untyped social network structures into a real
// type-script enum & interface.
export module UProxyClient {
  // Status of a client; used for both this client (in which case it will be
  // either ONLINE or OFFLINE)
  export enum Status {
    OFFLINE,
    // This client runs the same freedom.js app as you and is online
    ONLINE,
    // This client is online, but not with the same application/agent type
    // (i.e. can be useful to invite others to your freedom.js app)
    ONLINE_WITH_OTHER_APP,
  }

  // Status of a client connected to a social network.
  export interface State {
    userId    :string;
    clientId  :string;
    status    :Status;
    timestamp :number;
  }
}


// Status object for connected. This is an object so it can be bound in
// angular. connected = true iff connected to the app which is running
// freedom.
// TODO: this is chrome-specific. Move to the right place.
export interface StatusObject {
  connected :boolean;
}

export interface OAuthInfo {
  url :string;
  redirect :string
}

// Describing whether or not a remote instance is currently accessing or not,
// assuming consent is GRANTED for that particular pathway.
export enum GettingState {
  NONE = 100,
  TRYING_TO_GET_ACCESS,
  GETTING_ACCESS
};
export enum SharingState {
  NONE = 200,
  TRYING_TO_SHARE_ACCESS,
  SHARING_ACCESS
};

// Enums for Chrome App-Extension communication.
// Used when the Extension and App are initiating their connection.
//
// TODO: Eliminate this someday, when we can make uProxy in chrome not be split
// between an app and an extension.
export module ChromeMessage {
  export var CONNECT :string = 'connect';
  export var ACK :string = 'ack';
}

export interface UserPath {
  network :SocialNetworkInfo;
  userId :string;
}

export interface InstancePath extends UserPath {
  instanceId :string;
}


/**
 * Represents an entity whose state can be captured and restored, such as
 * with storage in a repository and subsequent retrieval.
 *
 * The interface represents state as an object, not as JSON text. JSON
 * serialization, if appropriate, occurs outside of this interface.
 */
export interface Persistent {

  /**
   * Returns the prefix string for saving / loading the object from storage.
   * Paths are slash-delimited.
   *
   * Expected: This function should return a string that ends with a /, for
   * further path appending.
   *
   * TODO: Why is the string a "prefix"? How is the prefix related to the
   * location at which the entity will be stored? What "appending" might
   * occur, and how is it related to implementations of this interface? Why
   * are persistent entities concerned with where they are stored?
   *
   * TODO: Consider removing this method. The issue of storage paths applies
   * only to saving & loading, but this interface is not involved in saving
   * or loading.
   */
  getStorePath :() => string;

  /**
   * Returns an object that encapsulates the state of the 'this' object.
   * There are no requirements regarding the content of the returned object,
   * except that it must be one that restoreState() is able to consume.
   *
   * Implementations MUST return objects that they will never again mutate.
   * All of the returned object's proeprty values must be of primitive types
   * or be deep copies. The reason is that callers expect the returned value
   * to be an unchanging representation of the state at the time
   * 'currentState' was called. For example, if an implementation simply sets
   * a property "foo" to the instance member 'foo_' of array type, then when
   * 'foo_' is mutated in the future states previously returned from
   * 'currentState' will also change, violating this interface's contract
   * and likely causing subtle breakage.
   */
  currentState :() => Object;

  /**
   * Updates the state of 'this' to match 'state'.
   */
  restoreState :(state :Object) => void;

}  // interface Core.Persistent


// Payloads for crossing the Core -> UI boundary.
export interface NetworkMessage {
  name    :string;
  online  :boolean;
  userId :string;
}

export interface UserProfileMessage {
  userId       :string;
  name         ?:string;
  imageData    ?:string; // Image URI (e.g. data:image/png;base64,adkwe329...)
  url          ?:string;
}

/**
 * UI-specific Instance.
 * TODO: Maybe turn this into an actual class. We'll see.
 */
export interface UiInstance {
  instanceId             :string;
  description            :string;
  localGettingFromRemote :GettingState;
  localSharingWithRemote :SharingState;
  isOnline               :boolean;
  bytesSent              :number;
  bytesReceived          :number;
}

export interface UserMessage {
  network             :string;
  user                :UserProfileMessage;
  consent             :ConsentState;
  offeringInstances   ?:Instance[];
  allInstanceIds      ?:string[];
  isOnline  :boolean;
}

/**
 * Proxy-state message is sent from the Core to the UI to indicate changes in
 * the current proxying state when received over the network. (e.g. The other
 * side has disconnected)
 * TODO: Actually implemnt the passing of this to the UI.
 */
export interface ProxyMessage {
  path    :InstancePath;
  access  :boolean;
}

// Object containing description so it can be saved to storage.
export interface GlobalSettings {
  version          :number;
  description      :string;
  stunServers      :freedom_RTCPeerConnection.RTCIceServer[];
  hasSeenSharingEnabledScreen :boolean;
  hasSeenWelcome   :boolean;
  allowNonUnicast  :boolean;
  mode             :Mode;
}


// TODO: Maybe wrap these in a module for everyting to do with Instances that
// needs to be accessible both in core and UI.

export interface SocialNetworkInfo {
  name :string;
  userId :string;
}

/**
 * LocalPeerId can contain the full instance paths so that we can easily
 * look up instance objects.
 */
export interface LocalPeerId {
  clientInstancePath :InstancePath;
  serverInstancePath :InstancePath;
}

/**
 * Base interface for all Instances.
 */
export interface Instance {
  instanceId  :string;
  keyHash     :string;
  status      ?:string; // Status on social network e.g. online or offline.
  notify      ?:boolean;   // TODO: replace with better notications
}

/**
 * Instance Handshakes are sent between uProxy installations to notify each
 * other about existence.
 */
export interface InstanceHandshake {
  instanceId  :string;
  keyHash     :string;
  consent     :ConsentWireState;
  description ?:string;
}
