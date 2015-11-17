import social = require('../interfaces/social');

export var NETWORK_OPTIONS :{[name:string]:social.NetworkOptions} = {
  'Google': {  // Old GTalk XMPP provider, being deprecated.
    displayName: 'Google Hangouts',
    isFirebase: false,
    enableMonitoring: true,
    areAllContactsUproxy: false,
    supportsReconnect: true,
    supportsInvites: false,
    isExperimental: true
  },
  'Facebook': {  // Old "v1" Facebook Firebase provider, being deprecated.
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    supportsInvites: false
  },
  'Facebook-Firebase-V2': {
    displayName: 'Facebook',
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    supportsInvites: true
  },
  'GMail': {
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    supportsInvites: true
  },
  'WeChat': {
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: false,
    supportsReconnect: false,
    supportsInvites: true,
    isExperimental: true
  },
  'GitHub': {
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: false,
    supportsInvites: true,
    isExperimental: true
  },
  'Quiver': {
    displayName: 'uProxy',
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    supportsInvites: true,
    isExperimental: true,
    encryptsWithClientId: true
  },
  'Cloud': {
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: false,
    supportsInvites: true,
    isExperimental: true
  }
};
