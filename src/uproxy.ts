/**
 * uproxy.ts
 *
 * This file defines the base uProxy module. It contains Enums and other code
 * which must be accessible from all parts of uProxy at runtime, especially
 * between the Core and the UI.
 */
// TODO: Move the notifications somewhere better.
/// <reference path='generic_core/consent.ts' />

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
    DESCRIPTION
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
    reset():void;

    // Send your own instanceId to target clientId.
    sendInstance(clientId:string):void;

    modifyConsent(command:ConsentCommand):void;

    // Using peer as a proxy.
    start(instanceId:string):void;
    stop(instanceId:string):void;

    updateDescription(description:string):void;
    changeOption(option:string):void;

    // TODO: improve the notifications feature
    dismissNotification(userId:string):void;

    // TODO: make network an actual type
    login(network:string):void;
    logout(network:string):void;
  }

  /**
   * The primary interface for the uProxy User Interface.
   */
  export interface UIAPI {

    // Global sync of all state.
    sync(state? : string) : void;

    update(type:Update, data?:any) : void;
    // TODO: Enforce these types of granular updates. (Doesn't have to be exactly
    // the below)...
    // updateAll(data:Object) : void;
    // updateNetwork(network:Social.Network) : void;
    // updateUser(user:Core.User) : void;
    // updateSelf(user:Core.User) : void;
    // Update an instance.
    // syncInstance(instance : any) : void;
    // updateMappings() : void;
    // updateIdentity(identity) : void;
    // addNotification() : void;
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
