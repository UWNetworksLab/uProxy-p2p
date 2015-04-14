  /**
   * uproxy.ts
   *
   * This file defines the base uProxy module types. It contains Enums and
   * interfaces which are relevant to all parts of uProxy, notably for
   * communication between the Core and the UI.
   */


// Renamings:
//   uProxy.* => uproxy_types.*    // from uproxy.d.ts
//   Instance => uproxy_types.Instance
//   Core.Persistent => uproxy_types.Persistent
//   UI.UserProfileMessage => uproxy_types.UserProfileMessage


export var STORAGE_VERSION = 1;
export var MESSAGE_VERSION = 1;
