/**
 * uproxy.ts
 *
 * This file defines the base uProxy module. It contains Enums and other code
 * which must be accessible from all parts of uProxy at runtime, especially
 * between the Core and the UI.
 */

module uProxy {

  /**
   * Commands are sent from the UI to the Core, always due to a user interaction.
   * This fully describes the set of commands which Core must respond to.
   */
  export enum Command {
    READY = 50,
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

  export enum Update {
    ALL,
    INSTANCE,
    DESCRIPTION,
    ID_MAPS,  // ClientId <---> InstanceId mappings.
  }

}  // module uProxy
