/**
 * uproxy.ts
 *
 * This file defines the base uProxy module. It contains Enums and other code
 * which must be accessible from all parts of uProxy at runtime, especially
 * between the Core and the UI.
 */
// TODO: Move the notifications somewhere better.
/// <reference path='generic_core/consent.ts' />
/// <reference path='interfaces/ui.d.ts' />

module uProxy {

  // --- Communications ---

  /**
   * Commands are sent from the UI to the Core, always due to a user interaction.
   * This fully describes the set of commands which Core must respond to.
   */
  export enum Command {
    READY = 1000,
    REFRESH,
    RESET,
    LOGIN,
    LOGOUT,
    SEND_INSTANCE,
    INVITE,
    CHANGE_OPTION,
    UPDATE_DESCRIPTION,
    DISMISS_NOTIFICATION,  // TODO: replace with some better notifications pipeline.
    START_PROXYING,
    STOP_PROXYING,
    MODIFY_CONSENT,       // TODO: make this work with the consent piece.
  }

  /**
   * Updates are sent from the Core to the UI, to update state which the UI must
   * expose to the user.
   */
  export enum Update {
    ALL = 2000,
    NETWORK,      // One particular network.
    USER_SELF,    // Local / myself on the network.
    USER_FRIEND,  // Remote friend on the roster.
    CLIENT,       // Single client for a User.
    INSTANCE,
    DESCRIPTION,
    ID_MAPS,  // ClientId <---> InstanceId mappings.
  }

  /**
   * Messages are sent from Core to a remote Core - they are peer communications
   * between uProxy users. This enum describes the possible Message types.
   */
  export enum MessageType {
    INSTANCE = 3000,  // Instance messages notify the user about instances.
    CONSENT,
    DESCRIPTION,
    // These are for the signalling-channel. The payloads are arbitrary, and
    // could be specified from uProxy, or could also be SDP headers forwarded
    // from socks-rtc's RTCPeerConnection.
    SIGNAL_FROM_CLIENT_PEER,
    SIGNAL_FROM_SERVER_PEER,
  }

  // Message should be the boundary for JSON parse / stringify.
  export interface Message {
    type :MessageType;
    data :Object;
  }

  /**
   * ConsentCommands are sent from the UI to the Core, to modify the consent of
   * a :RemoteInstance in the local client. (This is not sent on the wire).
   * This should only be associated with the Command.MODIFY_CONSENT command.
   */
  export interface ConsentCommand {
    // TODO: Replace these 3 with InstancePath.
    network    :string;
    userId     :string;
    instanceId :string;
    action     :Consent.UserAction;
  }

  // --- Core <--> UI Interfaces ---

  /**
   * The primary interface for the uProxy Core.
   *
   * This will be enforced for both the actual core implementation, as well as
   * abstraction layers such as the Chrome Extension, so that all components
   * which speak to the core benefit from this consistency.
   */
  export interface CoreAPI {

    // Clears all state and storage.
    reset() : void;

    // Send your own instanceId to target clientId.
    sendInstance(clientId :string) : void;

    modifyConsent(command :ConsentCommand) : void;

    // Using peer as a proxy.
    start(instancePath :InstancePath) : void;
    // TODO: Maybe in the future there will be the capacity to actually proxy
    // thorugh more than one remote instance at the same time. If that occurs,
    // then stop will need to take an :InstancePath as an argument. Otherwise,
    // nothing is necessary, since the instance is implied.
    stop () : void;

    updateDescription(description :string) : void;
    changeOption(option :string) : void;

    // TODO: improve the notifications feature
    dismissNotification(userId :string) : void;

    login(network :string) : void;
    logout(network :string) : void;

    onUpdate(update :Update, handler :Function) : void;
  }

  /**
   * The primary interface for the uProxy User Interface.
   * Currently, the UI update message types are specified in ui.d.ts.
   */
  export interface UIAPI {

    // Global sync of all state.

    sync(state? : string) : void;
    update(type:Update, data?:any) : void;

    syncUser(UserMessage :UI.UserMessage) : void;
    // TODO: Enforce these types of granular updates. (Doesn't have to be exactly
    // the below)...
    // updateAll(data:Object) : void;
    // updateNetwork(network:Social.Network) : void;
    // updateSelf(user:Core.User) : void;
    // Update an instance.
    // syncInstance(instance : any) : void;
    // updateMappings() : void;
    // updateIdentity(identity) : void;
    // addNotification() : void;
    refreshDOM :Function;

  }

  interface ICoreOptions {
    allowNonroutableAddresses(enabled:boolean):void;
    setStunServers(servers:string[]):void;
    setTurnServers(servers:string[]):void;
  }

}  // module uProxy


module UProxyClient {
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
interface StatusObject {
  connected :boolean;
}
