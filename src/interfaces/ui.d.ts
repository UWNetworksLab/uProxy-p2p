/**
 * ui.d.ts
 *
 * Interfaces specific to the UI.
 * (There are equivalents for these data structures on the Core side, but those
 * contain attributes / functionality not relevant to the UI.)
 */
/// <reference path='user.d.ts' />
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
    url          ?:string;
  }

  export interface UserMessage {
    network   :string;
    user      :UserProfileMessage;
    consent  :uProxy.ConsentState;
    offeringInstances ?:UI.Instance[];
    allInstanceIds ?:string[];
    isOnline  :boolean;
  }

  /**
   * UI-specific Instance.
   * TODO: Maybe turn this into an actual class. We'll see.
   */
  export interface Instance {
    instanceId             :string;
    description            :string;
    localGettingFromRemote :GettingState;
    localSharingWithRemote :SharingState;
    isOnline               :boolean;
    bytesSent              :number;
    bytesReceived          :number;
  }
}  // module UI
