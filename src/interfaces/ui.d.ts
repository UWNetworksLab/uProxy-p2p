/**
 * ui.d.ts
 *
 * Interfaces specific to the UI.
 * (There are equivalents for these data structures on the Core side, but those
 * contain attributes / functionality not relevant to the UI.)
 */
/// <reference path='user.d.ts' />
/// <reference path='../generic_ui/scripts/ui.ts' />
/// <reference path='instance.d.ts' />

declare module UI {

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
    isOnline     :boolean;
  }

  export interface UserMessage {
    network   :string;
    user      :UserProfileMessage;
    instances :UI.Instance[];
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

  /**
   * UI-specific Instance.
   * TODO: Maybe turn this into an actual class. We'll see.
   */
  export interface Instance {
    instanceId             :string;
    description            :string;
    consent                :Consent.State;
    localGettingFromRemote :GettingState;
    localSharingWithRemote :SharingState;
    isOnline               :boolean;
    bytesSent              :number;
    bytesReceived          :number;
  }

  /**
   * Data about a currently proxying server or client.
   */
  export interface CurrentProxy {
    instance :Instance;
    user :UI.User;
  }

}  // module UI
