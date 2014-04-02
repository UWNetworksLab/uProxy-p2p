/**
 * Commands are sent from the UI to the Core.
 * Updates are sent from the Core to the UI.
 */
declare module UI {

  export enum Command {
    READY,
    REFRESH,
    RESET,
    LOGIN,
    LOGOUT,
    INVITE,
    CHANGE_OPTION,
    UPDATE_DESCRIPTION,
    NOTIFICATION_SEEN,  // TODO: replace with some better notifications pipeline.
    START_PROXYING,
    STOP_PROXYING,
    MODIFY_CONSENT,  // TODO: make this work with the consent piece.
  }

}  // module UI
