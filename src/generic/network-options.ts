import social = require('../interfaces/social');

export var NETWORK_OPTIONS :{[name:string]:social.NetworkOptions} = {
  'Facebook-Firebase-V2': {
    displayName: 'Facebook',
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true
  },
  'GMail': {
    displayName: 'Gmail',  // fix incorrect capitalization "GMail"
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true
  },
  'WeChat': {
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: false,
    supportsReconnect: false,
    isExperimental: true
  },
  'GitHub': {
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: false,
    isExperimental: true
  },
  'Quiver': {
    displayName: 'uProxy',
    isFirebase: false,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    isExperimental: true,
    isEncrypted: true
  },
  'Cloud': {
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: false,
    isExperimental: true
  }
};
