/**
 * ui.d.ts
 *
 * Interfaces specific to the UI.
 * (There are equivalents for these data structures on the Core side, but those
 * contain attributes / functionality not relevant to the UI.)
 */

import uproxy_types = require('../uproxy');

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
  export interface Instance {
    instanceId             :string;
    description            :string;
    localGettingFromRemote :uproxy_types.GettingState;
    localSharingWithRemote :uproxy_types.SharingState;
    isOnline               :boolean;
    bytesSent              :number;
    bytesReceived          :number;
  }

  export interface UserMessage {
    network             :string;
    user                :UserProfileMessage;
    consent             :uproxy_types.ConsentState;
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
    path    :uproxy_types.InstancePath;
    access  :boolean;
  }
