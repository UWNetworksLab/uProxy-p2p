  /**
   * uproxy.ts
   *
   * This file defines the base uProxy module types. It contains Enums and
   * interfaces which are relevant to all parts of uProxy, notably for
   * communication between the Core and the UI.
   */


// Renamings:
//   Instance => user.BaseInstance
//   Persistent => Persistent   [ = require('interface/persistent'); ]
//   UI.UserProfileMessage => social.UserProfileData
//   UI.Instance => social.InstanceData
//   UI.UserMessage => social.UserData


export var STORAGE_VERSION = 1;
export var MESSAGE_VERSION = 1;
