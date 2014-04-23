/**
 * uproxy.ts
 *
 * This file defines the base uProxy module. It contains Enums and other code
 * which must be accessible from all parts of uProxy at runtime, especially
 * between the Core and the UI.
 */
// TODO: Move the notifications somewhere better.

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
    ROSTER,       // Single roster for one particular network.
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

    modifyConsent(id:string, action:Consent.Action):void;

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
   *
   * TODO: Provide an analogue of this interface in the Chrome App, so that
   * the Core can act as if it were speaking directly to the UI.
   */
  export interface UIAPI {

    // Global sync of all state.
    sync(state? : string) : void;

    // Update an instance.
    // syncInstance(instance : any) : void;
    updateMappings() : void;

    updateIdentity(identity) : void;
    sendConsent() : void;
    addNotification() : void;
  }


  interface ICoreOptions {
    allowNonroutableAddresses(enabled:boolean):void;
    setStunServers(servers:string[]):void;
    setTurnServers(servers:string[]):void;
  }

  // TODO: Remove this once we use the newer consent piece.
  export module Consent {
    export enum Action {
      REQUEST,
      CANCEL,
      ACCEPT,
      DECLINE,
      OFFER,
      ALLOW,
      DENY,
    }
  }  // module Consent

}  // module uProxy
